# app/services/request_service.py

from enum import IntEnum
from typing import Optional

from app.core.exceptions import ForbiddenError, NotFoundError, ConflictError
from app.infrastructure.database.models.request_model import RequestModel
from app.infrastructure.database.models.request_item_model import RequestItemModel
from app.infrastructure.database.models.request_item_field_model import RequestItemFieldModel
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.request_repository import RequestRepository
from app.repositories.request_item_repository import RequestItemRepository
from app.repositories.request_item_field_repository import RequestItemFieldRepository


class Role(IntEnum):
    ADMIN = 1
    ANALYST = 2
    USER = 3


class RequestService:
    def __init__(
        self,
        *,
        conv_repo: ConversationRepository,
        msg_repo: MessageRepository,
        req_repo: RequestRepository,
        item_repo: RequestItemRepository,
        field_repo: RequestItemFieldRepository,
    ) -> None:
        self._conv_repo = conv_repo
        self._msg_repo = msg_repo
        self._req_repo = req_repo
        self._item_repo = item_repo
        self._field_repo = field_repo

    # -------- Access helpers --------
    def _ensure_access_by_conversation(self, *, conversation_id: int, user_id: int, role_id: int) -> None:
        row = self._conv_repo.get_row_by_id(conversation_id)
        if row is None:
            raise NotFoundError("Conversa não encontrada.")

        conv, _, _ = row
        if role_id in (Role.ADMIN, Role.ANALYST):
            return
        if conv.created_by != user_id:
            raise ForbiddenError("Acesso negado.")

    def _conversation_id_from_message(self, message_id: int) -> int:
        row = self._msg_repo.get_row(message_id=message_id)
        if row is None:
            raise NotFoundError("Mensagem não encontrada.")
        msg, _sender = row
        return int(msg.conversation_id)

    # -------- CRUD: Request --------
    def create_request(
        self,
        *,
        message_id: int,
        created_by: int,
        role_id: int,
        items: list[dict],
    ) -> RequestModel:
        conversation_id = self._conversation_id_from_message(message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=created_by, role_id=role_id)

        existing = self._req_repo.get_by_message_id(message_id)
        if existing is not None:
            raise ConflictError("Já existe uma requisição para esta mensagem.")

        req = RequestModel(message_id=message_id, created_by=created_by)
        req = self._req_repo.add(req)

        # cria itens + fields
        for item in items:
            it = RequestItemModel(
                request_id=req.id,
                request_type_id=item["request_type_id"],
                request_status_id=item["request_status_id"],
                product_id=item.get("product_id"),
            )
            it = self._item_repo.add(it)

            fields_payload = item.get("fields") or []
            if fields_payload:
                field_models = [
                    RequestItemFieldModel(
                        request_items_id=it.id,
                        field_type_id=f["field_type_id"],
                        field_tag=f["field_tag"],
                        field_value=f.get("field_value"),
                        field_flag=f.get("field_flag"),
                    )
                    for f in fields_payload
                ]
                self._field_repo.add_many(field_models)

        return req

    def get_request(self, *, request_id: int, user_id: int, role_id: int) -> tuple[RequestModel, list[RequestItemModel], dict[int, list[RequestItemFieldModel]]]:
        req = self._req_repo.get_by_id(request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        items = self._item_repo.list_by_request_id(req.id)
        item_ids = [i.id for i in items]
        fields_map = self._field_repo.list_by_item_ids(item_ids)
        return req, items, fields_map

    def delete_request(self, *, request_id: int, user_id: int, role_id: int) -> None:
        req = self._req_repo.get_by_id(request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        self._field_repo.soft_delete_by_request_id(req.id)
        self._item_repo.soft_delete_by_request_id(req.id)

        ok = self._req_repo.soft_delete(request_id)
        if not ok:
            raise NotFoundError("Requisição não encontrada.")

    # -------- CRUD: Item --------
    def add_item(
        self,
        *,
        request_id: int,
        user_id: int,
        role_id: int,
        payload: dict,
    ) -> RequestItemModel:
        req = self._req_repo.get_by_id(request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        it = RequestItemModel(
            request_id=req.id,
            request_type_id=payload["request_type_id"],
            request_status_id=payload["request_status_id"],
            product_id=payload.get("product_id"),
        )
        it = self._item_repo.add(it)

        fields_payload = payload.get("fields") or []
        if fields_payload:
            field_models = [
                RequestItemFieldModel(
                    request_items_id=it.id,
                    field_type_id=f["field_type_id"],
                    field_tag=f["field_tag"],
                    field_value=f.get("field_value"),
                    field_flag=f.get("field_flag"),
                )
                for f in fields_payload
            ]
            self._field_repo.add_many(field_models)

        return it

    def update_item(self, *, item_id: int, user_id: int, role_id: int, values: dict) -> None:
        item = self._item_repo.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        ok = self._item_repo.update_fields(item_id, values)
        if not ok:
            raise NotFoundError("Item não encontrado.")

    def delete_item(self, *, item_id: int, user_id: int, role_id: int) -> None:
        item = self._item_repo.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        ok = self._item_repo.soft_delete(item_id)
        if not ok:
            raise NotFoundError("Item não encontrado.")

    # -------- CRUD: Field --------
    def add_field(self, *, item_id: int, user_id: int, role_id: int, payload: dict) -> RequestItemFieldModel:
        item = self._item_repo.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        field = RequestItemFieldModel(
            request_items_id=item.id,
            field_type_id=payload["field_type_id"],
            field_tag=payload["field_tag"],
            field_value=payload.get("field_value"),
            field_flag=payload.get("field_flag"),
        )
        return self._field_repo.add(field)

    def update_field(self, *, field_id: int, user_id: int, role_id: int, values: dict) -> None:
        field = self._field_repo.get_by_id(field_id)
        if field is None:
            raise NotFoundError("Campo não encontrado.")

        item = self._item_repo.get_by_id(field.request_items_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        ok = self._field_repo.update_fields(field_id, values)
        if not ok:
            raise NotFoundError("Campo não encontrado.")

    def delete_field(self, *, field_id: int, user_id: int, role_id: int) -> None:
        field = self._field_repo.get_by_id(field_id)
        if field is None:
            raise NotFoundError("Campo não encontrado.")

        item = self._item_repo.get_by_id(field.request_items_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        ok = self._field_repo.soft_delete(field_id)
        if not ok:
            raise NotFoundError("Campo não encontrado.")
