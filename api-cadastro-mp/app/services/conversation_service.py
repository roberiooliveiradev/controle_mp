# app/services/conversation_service.py
from __future__ import annotations

from enum import IntEnum
from datetime import timezone
from typing import Any

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.database.models.conversation_model import ConversationModel
from app.repositories.conversation_repository import ConversationRepository
from app.core.interfaces.conversation_notifier import ConversationNotifier, ConversationCreatedEvent


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

    def _iso(self, dt) -> str | None:
        if not dt:
            return None
        return dt.astimezone(timezone.utc).isoformat()

    def _can_access(self, *, role_id: int, user_id: int, created_by: int) -> bool:
        if role_id in (Role.ADMIN, Role.ANALYST):
            return True
        return created_by == user_id

    def _pack_user_mini(self, u) -> dict[str, Any] | None:
        if u is None:
            return None
        return {
            "id": int(getattr(u, "id")),
            "full_name": getattr(u, "full_name", None),
            "email": getattr(u, "email", None),
            "role_id": getattr(u, "role_id", None),
        }

    def _pack_conversation_full(self, conv: ConversationModel, creator, assignee) -> dict[str, Any]:
        # payload 100% JSON-safe (dicts/ints/strings/bools)
        return {
            "id": int(conv.id),
            "title": str(conv.title),
            "created_by": int(conv.created_by),
            "assigned_to": int(conv.assigned_to) if conv.assigned_to is not None else None,
            "has_flag": bool(getattr(conv, "has_flag", False)),
            "is_deleted": bool(getattr(conv, "is_deleted", False)),
            "created_at": self._iso(getattr(conv, "created_at", None)),
            "updated_at": self._iso(getattr(conv, "updated_at", None)),
            "creator": self._pack_user_mini(creator),
            "assignee": self._pack_user_mini(assignee),
        }

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

        # ✅ puxa o row completo (conv + creator + assignee) para emitir tudo
        row = self._repo.get_row_by_id(conv.id)
        if row is None:
            # extremamente improvável, mas mantém consistência
            raise NotFoundError("Conversa não encontrada após criação.")
        conv2, creator, assignee = row

        conversation_payload = self._pack_conversation_full(conv2, creator, assignee)

        event = ConversationCreatedEvent(
            conversation_id=int(conv2.id),
            title=str(conv2.title),
            created_by=int(conv2.created_by),
            assigned_to=int(conv2.assigned_to) if conv2.assigned_to is not None else None,
            created_at_iso=conv2.created_at.astimezone(timezone.utc).isoformat(),
            # ✅ novos campos (payload completo + minis)
            conversation=conversation_payload,
            creator=conversation_payload.get("creator"),
            assignee=conversation_payload.get("assignee"),
        )

        self._notifier.notify_conversation_created(event)
        return conv2

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

        # (opcional) aqui você pode criar um ConversationUpdatedEvent depois

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
