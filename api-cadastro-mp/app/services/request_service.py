# app/services/request_service.py

from enum import IntEnum
from typing import Optional
from datetime import timezone 

from app.core.exceptions import ForbiddenError, NotFoundError, ConflictError
from app.infrastructure.database.models.request_model import RequestModel
from app.infrastructure.database.models.request_item_model import RequestItemModel
from app.infrastructure.database.models.request_item_field_model import RequestItemFieldModel
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.request_repository import RequestRepository
from app.repositories.request_item_repository import RequestItemRepository
from app.repositories.request_item_field_repository import RequestItemFieldRepository

from app.repositories.request_status_repository import RequestStatusRepository
from app.repositories.request_type_repository import RequestTypeRepository

from app.core.interfaces.request_notifier import ( 
    RequestNotifier,
    RequestCreatedEvent,
    RequestItemChangedEvent,
)


class Role(IntEnum):
    ADMIN = 1
    ANALYST = 2
    USER = 3


class RequestStatus(IntEnum):
    CREATED = 1
    IN_PROGRESS = 2
    FINALIZED = 3
    FAILED = 4
    RETURNED = 5
    REJECTED = 6


class RequestService:
    def __init__(
        self,
        *,
        conv_repo: ConversationRepository,
        msg_repo: MessageRepository,
        req_repo: RequestRepository,
        item_repo: RequestItemRepository,
        field_repo: RequestItemFieldRepository,
        status_repo: RequestStatusRepository,
        type_repo: RequestTypeRepository,
        notifier: RequestNotifier | None = None,
    ) -> None:
        self._conv_repo = conv_repo
        self._msg_repo = msg_repo
        self._req_repo = req_repo
        self._item_repo = item_repo
        self._field_repo = field_repo
        self._status_repo = status_repo
        self._type_repo = type_repo
        self._notifier = notifier

    def _emit_request_created(
        self,
        *,
        req: RequestModel,
        conversation_id: int,
        created_by: int,
    ) -> None:
        if not self._notifier:
            return
        evt = RequestCreatedEvent(
            request_id=int(req.id),
            message_id=int(req.message_id),
            conversation_id=int(conversation_id),
            created_by=int(created_by),
            created_at_iso=req.created_at.astimezone(timezone.utc).isoformat(),
        )
        self._notifier.notify_request_created(evt)

    def _emit_item_changed(
        self,
        *,
        req: RequestModel,
        conversation_id: int,
        item: RequestItemModel,
        changed_by: int,
        change_kind: str,
    ) -> None:
        if not self._notifier:
            return

        # 🔎 tenta usar updated_at do item (se houver), senão created_at
        dt = item.updated_at or item.created_at
        iso = dt.astimezone(timezone.utc).isoformat() if dt else None

        evt = RequestItemChangedEvent(
            request_id=int(req.id),
            item_id=int(item.id),
            message_id=int(req.message_id),
            conversation_id=int(conversation_id),
            changed_by=int(changed_by),
            change_kind=change_kind,
            request_status_id=int(item.request_status_id) if item.request_status_id is not None else None,
            updated_at_iso=iso or "",
        )
        self._notifier.notify_request_item_changed(evt)

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

    def _ensure_user_can_edit_item(
        self,
        *,
        req: RequestModel,
        item: RequestItemModel,
        user_id: int,
        role_id: int,
    ) -> None:
        """USER só edita quando for dono e o status do item for RETURNED."""
        if role_id in (Role.ADMIN, Role.ANALYST):
            return

        if req.created_by != user_id:
            raise ForbiddenError("Acesso negado.")

        if int(item.request_status_id) != int(RequestStatus.RETURNED):
            raise ForbiddenError(
                "Você só pode alterar quando a solicitação foi devolvida para correção (RETURNED)."
            )

    def _ensure_can_change_status(self, *, role_id: int) -> None:
        if role_id not in (Role.ADMIN, Role.ANALYST):
            raise ForbiddenError("Apenas ANALYST/ADMIN podem alterar o status.")

    def _resubmit_if_returned(self, *, item: RequestItemModel, role_id: int) -> None:
        """
     Regra de negócio:
        Quando USER corrigir um item RETURNED, ele volta para CREATED automaticamente.
        Admin/Analyst não sofrem essa regra.
        """
        if role_id != Role.USER:
            self._item_repo.touch_updated_at(int(item.id))
            return
        if int(item.request_status_id) != int(RequestStatus.RETURNED):
            self._item_repo.touch_updated_at(int(item.id))
            return

        # seta para CREATED (reenviado)
        self._item_repo.update_fields(int(item.id), {"request_status_id": int(RequestStatus.CREATED)})

    # -------- Listagem para tela --------
    def list_request_items(
        self,
        *,
        user_id: int,
        role_id: int,
        limit: int,
        offset: int,
        status_id: Optional[int] = None,
        created_by: Optional[int] = None,
    ) -> tuple[list[dict], int]:
        """Lista RequestItems (flattened) para tela de listagem."""
        if role_id == Role.USER:
            created_by = user_id

        rows, total = self._item_repo.list_items_for_page(
            limit=limit,
            offset=offset,
            status_id=status_id,
            created_by=created_by,
        )

        type_ids = list({int(r["request_type_id"]) for r in rows if r.get("request_type_id") is not None})
        status_ids = list({int(r["request_status_id"]) for r in rows if r.get("request_status_id") is not None})

        type_map = self._type_repo.get_map_by_ids(type_ids)
        status_map = self._status_repo.get_map_by_ids(status_ids)

        for r in rows:
            tid = int(r["request_type_id"])
            sid = int(r["request_status_id"])
            t = type_map.get(tid)
            s = status_map.get(sid)
            r["request_type"] = {"id": t.id, "type_name": t.type_name} if t is not None else None
            r["request_status"] = {"id": s.id, "status_name": s.status_name} if s is not None else None

        return rows, int(total)

    # -------- Alterar status (analyst/admin) --------
    def change_item_status(
        self,
        *,
        item_id: int,
        new_status_id: int,
        user_id: int,
        role_id: int,
    ) -> None:
        self._ensure_can_change_status(role_id=role_id)

        item = self._item_repo.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        allowed = {
            int(RequestStatus.IN_PROGRESS),
            int(RequestStatus.FINALIZED),
            int(RequestStatus.RETURNED),
            int(RequestStatus.REJECTED),
        }
        if int(new_status_id) not in allowed:
            raise ConflictError("Status inválido para esta operação.")

        ok = self._item_repo.update_fields(item_id, {"request_status_id": int(new_status_id)})
        if not ok:
            raise NotFoundError("Item não encontrado.")

        # recarrega item para pegar status/updated_at atual
        item2 = self._item_repo.get_by_id(item_id) or item
        self._emit_item_changed(
            req=req,
            conversation_id=conversation_id,
            item=item2,
            changed_by=user_id,
            change_kind="STATUS",
        )


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

        created_first_item: RequestItemModel | None = None

        for item in items:
            it = RequestItemModel(
                request_id=req.id,
                request_type_id=item["request_type_id"],
                request_status_id=item["request_status_id"],
                product_id=item.get("product_id"),
            )
            it = self._item_repo.add(it)

            if created_first_item is None:
                created_first_item = it

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

        # eventos realtime
        self._emit_request_created(req=req, conversation_id=conversation_id, created_by=created_by)
        if created_first_item is not None:
            self._emit_item_changed(
                req=req,
                conversation_id=conversation_id,
                item=created_first_item,
                changed_by=created_by,
                change_kind="ITEM",
            )

        return req

    def get_request(
        self,
        *,
        request_id: int,
        user_id: int,
        role_id: int,
    ) -> tuple[
        RequestModel,
        list[RequestItemModel],
        dict[int, list[RequestItemFieldModel]],
        dict[int, "RequestTypeModel"],
        dict[int, "RequestStatusModel"],
    ]:
        req = self._req_repo.get_by_id(request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        items = self._item_repo.list_by_request_id(req.id)

        item_ids = [int(i.id) for i in items]
        fields_map = self._field_repo.list_by_item_ids(item_ids)

        type_ids = list({int(i.request_type_id) for i in items if i.request_type_id is not None})
        status_ids = list({int(i.request_status_id) for i in items if i.request_status_id is not None})

        type_map = self._type_repo.get_map_by_ids(type_ids)
        status_map = self._status_repo.get_map_by_ids(status_ids)

        return req, items, fields_map, type_map, status_map

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

        # regra: USER só pode editar quando devolvido
        self._ensure_user_can_edit_item(req=req, item=item, user_id=user_id, role_id=role_id)

        ok = self._item_repo.update_fields(item_id, values)

        if not ok:
            raise NotFoundError("Item não encontrado.")

        # após corrigir (USER), volta para CREATED
        self._resubmit_if_returned(item=item, role_id=role_id)

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

        # se USER estiver corrigindo, precisa estar RETURNED
        self._ensure_user_can_edit_item(req=req, item=item, user_id=user_id, role_id=role_id)

        field = RequestItemFieldModel(
            request_items_id=item.id,
            field_type_id=payload["field_type_id"],
            field_tag=payload["field_tag"],
            field_value=payload.get("field_value"),
            field_flag=payload.get("field_flag"),
        )
        created = self._field_repo.add(field)

        # após corrigir (USER), volta para CREATED
        self._resubmit_if_returned(item=item, role_id=role_id)
        return created

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

        # regra: USER só pode editar quando devolvido
        self._ensure_user_can_edit_item(req=req, item=item, user_id=user_id, role_id=role_id)

        ok = self._field_repo.update_fields(field_id, values)
        if not ok:
            raise NotFoundError("Campo não encontrado.")

        # após corrigir (USER), volta para CREATED
        self._resubmit_if_returned(item=item, role_id=role_id)
        
        # emite realtime (FIELDS)
        item2 = self._item_repo.get_by_id(int(item.id)) or item
        self._emit_item_changed(
            req=req,
            conversation_id=conversation_id,
            item=item2,
            changed_by=user_id,
            change_kind="FIELDS",
        )

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

        # se USER estiver corrigindo, precisa estar RETURNED
        self._ensure_user_can_edit_item(req=req, item=item, user_id=user_id, role_id=role_id)

        ok = self._field_repo.soft_delete(field_id)
        if not ok:
            raise NotFoundError("Campo não encontrado.")

        # após corrigir (USER), volta para CREATED
        self._resubmit_if_returned(item=item, role_id=role_id)
