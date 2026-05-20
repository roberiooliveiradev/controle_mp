# app/infrastructure/integrations/delpi_notification_service.py
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.interfaces.conversation_notifier import ConversationCreatedEvent
from app.core.interfaces.message_notifier import MessageCreatedEvent
from app.core.interfaces.request_notifier import RequestCreatedEvent, RequestItemChangedEvent
from app.infrastructure.database.models.conversation_model import ConversationModel
from app.infrastructure.database.models.conversation_participant_model import (
    ConversationParticipantModel,
)
from app.infrastructure.database.models.user_model import UserModel
from app.infrastructure.integrations.delpi_notification_client import DelpiNotificationClient
from app.repositories.user_repository import UserRepository

ROLE_ADMIN = 1
ROLE_ANALYST = 2
ROLE_USER = 3


class DelpiNotificationService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._users = UserRepository(session)
        self._client = DelpiNotificationClient()

    def on_message_created(self, event: MessageCreatedEvent) -> None:
        if event.message_type_code == "REQUEST":
            return

        conv = self._session.get(ConversationModel, event.conversation_id)
        if conv is None:
            return

        recipient_ids = self._conversation_recipient_user_ids(
            conversation_id=event.conversation_id,
            conv=conv,
            exclude_user_id=event.sender_id,
        )
        emails = self._users.list_emails_by_ids(recipient_ids)
        if not emails:
            return

        sender_name = "Alguém"
        if event.sender and isinstance(event.sender, dict):
            sender_name = (
                event.sender.get("full_name")
                or event.sender.get("name")
                or sender_name
            )

        title = conv.title or "Conversa"
        preview = (event.preview or event.body or "").strip()
        body = (
            f"{sender_name}: {preview}"
            if preview
            else f"{sender_name} enviou uma mensagem."
        )

        self._client.dispatch(
            emails=emails,
            title=f"Controle MP — {title}",
            message=body,
            notification_type="info",
            deep_path=f"/conversations/{event.conversation_id}",
            event="message:new",
            dedupe_key=f"cmp:msg:{event.message_id}",
            action_label="Abrir conversa",
            metadata_extra={
                "conversationId": event.conversation_id,
                "messageId": event.message_id,
            },
        )

    def on_conversation_created(self, event: ConversationCreatedEvent) -> None:
        recipient_ids: set[int] = set()

        for uid in self._users.list_user_ids_by_roles([ROLE_ADMIN, ROLE_ANALYST]):
            if uid != event.created_by:
                recipient_ids.add(uid)

        if event.assigned_to and event.assigned_to != event.created_by:
            recipient_ids.add(int(event.assigned_to))

        emails = self._users.list_emails_by_ids(recipient_ids)
        if not emails:
            return

        title = (event.title or "Nova conversa").strip()
        self._client.dispatch(
            emails=emails,
            title="Controle MP — Nova conversa",
            message=title,
            notification_type="info",
            deep_path=f"/conversations/{event.conversation_id}",
            event="conversation:new",
            dedupe_key=f"cmp:conv:{event.conversation_id}",
            action_label="Abrir conversa",
            metadata_extra={"conversationId": event.conversation_id},
        )

    def on_request_created(self, event: RequestCreatedEvent) -> None:
        creator = self._users.get_by_id(event.created_by)
        if creator is None:
            return

        recipient_ids: set[int] = set()

        if int(creator.role_id) == ROLE_USER:
            for uid in self._users.list_user_ids_by_roles([ROLE_ADMIN, ROLE_ANALYST]):
                if uid != event.created_by:
                    recipient_ids.add(uid)
        else:
            owner_id = None
            if event.request and isinstance(event.request, dict):
                owner_id = event.request.get("created_by") or event.request.get("user_id")
            if owner_id is not None:
                owner_id = int(owner_id)
            conv = self._session.get(ConversationModel, event.conversation_id)
            if owner_id is None and conv is not None:
                owner_id = int(conv.created_by)
            if owner_id and owner_id != event.created_by:
                recipient_ids.add(owner_id)

        emails = self._users.list_emails_by_ids(recipient_ids)
        if not emails:
            return

        self._client.dispatch(
            emails=emails,
            title="Controle MP — Nova solicitação",
            message="Uma nova solicitação de matéria-prima foi registrada.",
            notification_type="success",
            deep_path="/requests",
            event="request:created",
            dedupe_key=f"cmp:req:{event.request_id}",
            action_label="Ver solicitações",
            metadata_extra={
                "requestId": event.request_id,
                "conversationId": event.conversation_id,
            },
        )

    def on_request_item_changed(self, event: RequestItemChangedEvent) -> None:
        owner_id = event.changed_by
        if event.request and isinstance(event.request, dict):
            owner_id = int(
                event.request.get("created_by")
                or event.request.get("user_id")
                or owner_id
            )

        status_id = event.request_status_id
        recipient_ids = self._request_item_recipient_ids(
            changed_by=event.changed_by,
            request_owner_id=owner_id,
            status_id=status_id,
        )
        emails = self._users.list_emails_by_ids(recipient_ids)
        if not emails:
            return

        notif_type, text = _status_notification_copy(status_id)

        deep_path = "/requests"
        if event.conversation_id:
            deep_path = f"/conversations/{event.conversation_id}"

        self._client.dispatch(
            emails=emails,
            title="Controle MP — Solicitação atualizada",
            message=text,
            notification_type=notif_type,
            deep_path=deep_path,
            event="request:item_changed",
            dedupe_key=f"cmp:req-item:{event.item_id}:st:{status_id}",
            action_label="Abrir",
            metadata_extra={
                "requestId": event.request_id,
                "requestItemId": event.item_id,
                "conversationId": event.conversation_id,
            },
        )

    def _conversation_recipient_user_ids(
        self,
        *,
        conversation_id: int,
        conv: ConversationModel,
        exclude_user_id: int,
    ) -> set[int]:
        ids: set[int] = set()

        stmt = select(ConversationParticipantModel.user_id).where(
            ConversationParticipantModel.conversation_id == conversation_id,
            ConversationParticipantModel.is_deleted.is_(False),
        )
        for row in self._session.execute(stmt).all():
            uid = int(row[0])
            if uid != exclude_user_id:
                ids.add(uid)

        if conv.created_by and conv.created_by != exclude_user_id:
            ids.add(int(conv.created_by))

        if conv.assigned_to and conv.assigned_to != exclude_user_id:
            ids.add(int(conv.assigned_to))

        # Analistas/admin veem todas as conversas no app (socket global).
        # Sem isso, o DELPI só notificava quem já tinha aberto a conversa.
        for uid in self._users.list_user_ids_by_roles([ROLE_ADMIN, ROLE_ANALYST]):
            if uid != exclude_user_id:
                ids.add(uid)

        return ids

    def _request_item_recipient_ids(
        self,
        *,
        changed_by: int,
        request_owner_id: int | None,
        status_id: int | None,
    ) -> set[int]:
        ids: set[int] = set()

        for uid in self._users.list_user_ids_by_roles([ROLE_ADMIN, ROLE_ANALYST]):
            if uid != changed_by:
                ids.add(uid)

        if request_owner_id and request_owner_id != changed_by:
            user = self._users.get_by_id(request_owner_id)
            if user:
                role_id = int(user.role_id)
                if role_id in (ROLE_ADMIN, ROLE_ANALYST):
                    ids.add(request_owner_id)
                elif role_id == ROLE_USER and (
                    request_owner_id == int(user.id) or status_id == 1
                ):
                    ids.add(request_owner_id)

        return ids


def _status_notification_copy(status_id: int | None) -> tuple[str, str]:
    n = int(status_id or 0)
    if n == 1:
        return "success", "Solicitação retornada para análise."
    if n == 2:
        return "warning", "Solicitação em análise."
    if n == 3:
        return "success", "Solicitação aprovada."
    if n == 4:
        return "error", "Solicitação reprovada."
    if n == 5:
        return "warning", "Solicitação devolvida para correção."
    if n == 6:
        return "error", "Solicitação rejeitada."
    return "info", "Solicitação atualizada."
