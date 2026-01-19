# app/services/conversation_service.py
from enum import IntEnum

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.database.models.conversation_model import ConversationModel
from app.repositories.conversation_repository import ConversationRepository

from app.core.interfaces.conversation_notifier import ConversationNotifier
from datetime import timezone
from app.core.interfaces.conversation_notifier import ConversationCreatedEvent


class Role(IntEnum):
    ADMIN = 1
    ANALYST = 2
    USER = 3


class ConversationService:
    def __init__(
        self,
        conversation_repository: ConversationRepository,
        notifier: ConversationNotifier, 
    ) -> None:
        self._repo = conversation_repository
        self._notifier = notifier


    def _can_access(self, *, role_id: int, user_id: int, created_by: int) -> bool:
        if role_id in (Role.ADMIN, Role.ANALYST):
            return True
        return created_by == user_id

    def list_conversations(self, *, user_id: int, role_id: int, limit: int = 50, offset: int = 0):
        if role_id in (Role.ADMIN, Role.ANALYST):
            return self._repo.list_all_conversations_rows(limit=limit, offset=offset)
        return self._repo.list_my_conversations_rows(user_id=user_id, limit=limit, offset=offset)

    def get_conversation(self, *, conversation_id: int, user_id: int, role_id: int):
        row = self._repo.get_row_by_id(conversation_id)
        if row is None:
            raise NotFoundError("Conversa não encontrada.")
        conv, creator, assignee = row
        if not self._can_access(role_id=role_id, user_id=user_id, created_by=conv.created_by):
            raise ForbiddenError("Acesso negado.")
        return row

    def create_conversation(
        self,
        *,
        title: str,
        created_by: int,
        assigned_to: int | None,
        has_flag: bool = False,
    ) -> ConversationModel:
        model = ConversationModel(
            title=title.strip(),
            created_by=created_by,
            assigned_to=assigned_to,
            has_flag=has_flag,
        )

        conv = self._repo.add(model)

        event = ConversationCreatedEvent(
            conversation_id=conv.id,
            title=conv.title,
            created_by=conv.created_by,
            assigned_to=conv.assigned_to,
            created_at_iso=conv.created_at.astimezone(timezone.utc).isoformat(),
        )

        self._notifier.notify_conversation_created(event)
        return conv

    def update_conversation(
        self,
        *,
        conversation_id: int,
        user_id: int,
        role_id: int,
        title: str | None,
        has_flag: bool | None,
        assigned_to: int | None,
    ) -> None:
        # checa existência + permissão
        row = self._repo.get_row_by_id(conversation_id)
        if row is None:
            raise NotFoundError("Conversa não encontrada.")
        conv, _, _ = row
        if not self._can_access(role_id=role_id, user_id=user_id, created_by=conv.created_by):
            raise ForbiddenError("Acesso negado.")

        ok = self._repo.update_fields(
            conversation_id=conversation_id,
            title=title,
            has_flag=has_flag,
            assigned_to=assigned_to,
        )
        if not ok:
            raise NotFoundError("Conversa não encontrada.")

    def delete_conversation(self, *, conversation_id: int, user_id: int, role_id: int) -> None:
        row = self._repo.get_row_by_id(conversation_id)
        if row is None:
            raise NotFoundError("Conversa não encontrada.")
        conv, _, _ = row
        if not self._can_access(role_id=role_id, user_id=user_id, created_by=conv.created_by):
            raise ForbiddenError("Acesso negado.")

        ok = self._repo.soft_delete(conversation_id)
        if not ok:
            raise NotFoundError("Conversa não encontrada.")
