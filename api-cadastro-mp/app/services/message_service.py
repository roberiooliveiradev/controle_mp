# app/services/message_service.py

from enum import IntEnum
from datetime import timezone

from app.core.exceptions import ForbiddenError, NotFoundError, ConflictError
from app.infrastructure.database.models.message_model import MessageModel
from app.infrastructure.database.models.message_file_model import MessageFileModel

from app.repositories.conversation_repository import ConversationRepository
from app.repositories.conversation_participant_repository import ConversationParticipantRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.message_file_repository import MessageFileRepository
from app.repositories.request_repository import RequestRepository
from app.repositories.message_type_repository import MessageTypeRepository

from app.infrastructure.realtime.socketio_server import socketio
from app.core.interfaces.message_notifier import MessageNotifier, MessageCreatedEvent

from app.services.request_service import RequestService


class Role(IntEnum):
    ADMIN = 1
    ANALYST = 2
    USER = 3


class MessageService:
    def __init__(
        self,
        *,
        conv_repo: ConversationRepository,
        part_repo: ConversationParticipantRepository,
        msg_repo: MessageRepository,
        file_repo: MessageFileRepository,
        req_repo: RequestRepository,
        type_repo: MessageTypeRepository,
        notifier: MessageNotifier,
        req_service: RequestService,
    ) -> None:
        self._conv_repo = conv_repo
        self._part_repo = part_repo
        self._msg_repo = msg_repo
        self._file_repo = file_repo
        self._req_repo = req_repo
        self._type_repo = type_repo
        self._notifier = notifier
        self._req_service = req_service

    def _get_conversation_or_404(self, conversation_id: int):
        row = self._conv_repo.get_row_by_id(conversation_id)
        if row is None:
            raise NotFoundError("Conversa não encontrada.")
        return row  # (conv, creator, assignee)

    def _ensure_access(self, *, conversation_id: int, user_id: int, role_id: int):
        conv, _, _ = self._get_conversation_or_404(conversation_id)
        if role_id in (Role.ADMIN, Role.ANALYST):
            return conv
        if conv.created_by != user_id:
            raise ForbiddenError("Acesso negado.")
        return conv

    def _compute_is_read(self, *, participant_last_read_message_id: int | None, message_id: int) -> bool:
        if participant_last_read_message_id is None:
            return False
        return message_id <= participant_last_read_message_id

    def create_message(
        self,
        *,
        conversation_id: int,
        user_id: int,
        role_id: int,
        message_type_id: int,
        body: str | None,
        files: list[dict] | None,
        create_request: bool,
        request_items: list[dict] | None = None,
    ) -> MessageModel:
        self._ensure_access(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        # garante participant (pra leitura funcionar)
        self._part_repo.ensure(conversation_id=conversation_id, user_id=user_id)

        raw_body = body if body is not None else None
        body_for_validation = raw_body.strip() if raw_body is not None else None

        has_text = bool(body_for_validation)
        has_files = bool(files)
        has_request = bool(create_request)

        if not (has_text or has_files or has_request):
            raise ConflictError("Mensagem inválida: informe texto, arquivos ou requisição.")

        request_type_id = self._type_repo.get_id_by_code("REQUEST")
        if request_type_id is None:
            raise ConflictError('Seed ausente: tbMessageTypes deve conter code="REQUEST".')

        system_type_id = self._type_repo.get_id_by_code("SYSTEM")
        if system_type_id is None:
            raise ConflictError('Seed ausente: tbMessageTypes deve conter code="SYSTEM".')

        if message_type_id == system_type_id:
            raise ConflictError("Não é permitido criar mensagens do tipo SYSTEM via API.")

        # Se vai criar request, o tipo tem que ser REQUEST
        if create_request and message_type_id != request_type_id:
            raise ConflictError("Para criar uma requisição, message_type_id deve ser REQUEST.")

        # Se o tipo é REQUEST, garante que haverá request
        if message_type_id == request_type_id and not create_request:
            create_request = True

        if create_request:
            if not request_items or len(request_items) == 0:
                raise ConflictError("Para criar uma request, informe ao menos 1 item (request_items).")

        msg = MessageModel(
            conversation_id=conversation_id,
            sender_id=user_id,
            message_type_id=message_type_id,
            body=raw_body if has_text else None,
        )
        msg = self._msg_repo.add(msg)

        # arquivos (metadados)
        if files:
            file_models: list[MessageFileModel] = []
            for f in files:
                file_models.append(
                    MessageFileModel(
                        message_id=msg.id,
                        original_name=f["original_name"],
                        stored_name=f["stored_name"],
                        content_type=f.get("content_type"),
                        size_bytes=f.get("size_bytes"),
                        sha256=f.get("sha256"),
                    )
                )
            self._file_repo.add_many(file_models)

        # ✅ cria request + itens/fields via RequestService
        if create_request:
            self._req_service.create_request(
                message_id=msg.id,
                created_by=user_id,
                role_id=role_id,
                items=request_items or [],
            )

        self._conv_repo.touch(conversation_id)

        event = MessageCreatedEvent(
            conversation_id=conversation_id,
            message_id=msg.id,
            sender_id=user_id,
            body=msg.body,
            created_at_iso=msg.created_at.astimezone(timezone.utc).isoformat(),
        )
        self._notifier.notify_message_created(event)

        return msg

    def list_messages(self, *, conversation_id: int, user_id: int, role_id: int, limit: int, offset: int):
        self._ensure_access(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        participant = self._part_repo.ensure(conversation_id=conversation_id, user_id=user_id)
        rows = self._msg_repo.list_rows_by_conversation(conversation_id=conversation_id, limit=limit, offset=offset)

        message_ids = [msg.id for (msg, _sender) in rows]
        files_map = self._file_repo.list_by_message_ids(message_ids)
        req_map = self._req_repo.get_by_message_ids(message_ids)

        out = []
        for msg, sender in rows:
            out.append(
                {
                    "msg": msg,
                    "sender": sender,
                    "files": files_map.get(msg.id, []),
                    "request": req_map.get(msg.id),
                    "is_read": self._compute_is_read(
                        participant_last_read_message_id=participant.last_read_message_id,
                        message_id=msg.id,
                    ),
                }
            )
        return out

    def get_message(self, *, conversation_id: int, message_id: int, user_id: int, role_id: int):
        self._ensure_access(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        participant = self._part_repo.ensure(conversation_id=conversation_id, user_id=user_id)
        row = self._msg_repo.get_row(message_id=message_id)
        if row is None:
            raise NotFoundError("Mensagem não encontrada.")

        msg, sender = row
        if msg.conversation_id != conversation_id:
            raise NotFoundError("Mensagem não encontrada.")

        files_map = self._file_repo.list_by_message_ids([msg.id])
        req_map = self._req_repo.get_by_message_ids([msg.id])

        return {
            "msg": msg,
            "sender": sender,
            "files": files_map.get(msg.id, []),
            "request": req_map.get(msg.id),
            "is_read": self._compute_is_read(
                participant_last_read_message_id=participant.last_read_message_id,
                message_id=msg.id,
            ),
        }

    def delete_message(self, *, conversation_id: int, message_id: int, user_id: int, role_id: int) -> None:
        self._ensure_access(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        row = self._msg_repo.get_row(message_id=message_id)
        if row is None:
            raise NotFoundError("Mensagem não encontrada.")

        msg, _sender = row
        if msg.conversation_id != conversation_id:
            raise NotFoundError("Mensagem não encontrada.")

        if role_id == Role.USER and msg.sender_id != user_id:
            raise ForbiddenError("Acesso negado.")

        ok = self._msg_repo.soft_delete(message_id=message_id)
        if not ok:
            raise NotFoundError("Mensagem não encontrada.")

        self._conv_repo.touch(conversation_id)

    def mark_read(self, *, conversation_id: int, user_id: int, role_id: int, message_ids: list[int]) -> int:
        self._ensure_access(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        self._part_repo.ensure(conversation_id=conversation_id, user_id=user_id)

        max_id = self._msg_repo.max_message_id_in_conversation(
            conversation_id=conversation_id, message_ids=message_ids
        )
        if max_id is None:
            return 0

        self._part_repo.set_last_read(conversation_id=conversation_id, user_id=user_id, last_read_message_id=max_id)

        socketio.emit(
            "message:read",
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "last_read_message_id": max_id,
            },
            room=f"conversation:{conversation_id}",
        )
        return 1
