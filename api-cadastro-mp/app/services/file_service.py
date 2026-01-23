# app/services/file_service.py
from __future__ import annotations

from enum import IntEnum

from app.core.exceptions import ForbiddenError, NotFoundError
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_file_repository import MessageFileRepository


class Role(IntEnum):
    ADMIN = 1
    ANALYST = 2
    USER = 3


class FileService:
    def __init__(
        self,
        *,
        conv_repo: ConversationRepository,
        file_repo: MessageFileRepository,
    ) -> None:
        self._conv_repo = conv_repo
        self._file_repo = file_repo

    def _get_conversation_or_404(self, conversation_id: int):
        row = self._conv_repo.get_row_by_id(conversation_id)
        if row is None:
            raise NotFoundError("Conversa não encontrada.")
        return row  # (conv, creator, assignee)

    def _ensure_access(self, *, conversation_id: int, user_id: int, role_id: int):
        conv, _, _ = self._get_conversation_or_404(conversation_id)
        if role_id in (Role.ADMIN, Role.ANALYST):
            return
        if conv.created_by != user_id:
            raise ForbiddenError("Acesso negado.")

    def get_file_for_download(self, *, file_id: int, user_id: int, role_id: int):
        row = self._file_repo.get_file_and_message(file_id=file_id)
        if row is None:
            raise NotFoundError("Arquivo não encontrado.")

        f, msg = row

        # valida acesso por conversa (mensagem -> conversation_id)
        self._ensure_access(conversation_id=msg.conversation_id, user_id=user_id, role_id=role_id)

        return f
