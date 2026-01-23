# app/services/request_service.py

from __future__ import annotations

from enum import IntEnum
from typing import Optional
from datetime import timezone, date

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
from app.repositories.product_repository import ProductRepository
from app.repositories.product_field_repository import ProductFieldRepository
from app.services.product_service import ProductService
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


class RequestType(IntEnum):
    CREATE = 1
    UPDATE = 2


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
        product_repo: ProductRepository,
        pfield_repo: ProductFieldRepository,
        notifier: RequestNotifier | None = None,
    ) -> None:
        self._conv_repo = conv_repo
        self._msg_repo = msg_repo
        self._req_repo = req_repo
        self._item_repo = item_repo
        self._field_repo = field_repo
        self._status_repo = status_repo
        self._type_repo = type_repo
        self._product_repo = product_repo
        self._pfield_repo = pfield_repo
        self._notifier = notifier

    # ---------------- Realtime events ----------------
    def _emit_request_created(self, *, req: RequestModel, conversation_id: int, created_by: int) -> None:
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

        dt = item.updated_at or item.created_at
        iso = dt.astimezone(timezone.utc).isoformat() if dt else ""

        evt = RequestItemChangedEvent(
            request_id=int(req.id),
            item_id=int(item.id),
            message_id=int(req.message_id),
            conversation_id=int(conversation_id),
            changed_by=int(changed_by),
            change_kind=change_kind,
            request_status_id=int(item.request_status_id) if item.request_status_id is not None else None,
            updated_at_iso=iso,
        )
        self._notifier.notify_request_item_changed(evt)

    # ---------------- Access helpers ----------------
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

    # ---------------- Global locks ----------------
    def _ensure_not_locked(self, *, item: RequestItemModel) -> None:
        if int(item.request_status_id) in (int(RequestStatus.FINALIZED), int(RequestStatus.REJECTED)):
            raise ConflictError("Item FINALIZED/REJECTED não pode ser alterado.")

    def _ensure_can_change_status(self, *, role_id: int) -> None:
        if role_id not in (Role.ADMIN, Role.ANALYST):
            raise ForbiddenError("Apenas ANALYST/ADMIN podem alterar o status.")

    # ---------------- Type helpers ----------------
    def _get_request_type_name(self, request_type_id: int | None) -> str | None:
        if request_type_id is None:
            return None
        mp = self._type_repo.get_map_by_ids([int(request_type_id)])
        t = mp.get(int(request_type_id))
        if t is None:
            return None
        return str(getattr(t, "type_name", "") or "").strip().upper() or None

    def _is_create_item(self, item: RequestItemModel) -> bool:
        # name = self._get_request_type_name(int(item.request_type_id) if item.request_type_id is not None else None)
        # if name:
        #     return name == "CREATE"
        return int(item.request_type_id or 0) == int(RequestType.CREATE)

    def _is_update_item(self, item: RequestItemModel) -> bool:
        # name = self._get_request_type_name(int(item.request_type_id) if item.request_type_id is not None else None)
        # if name:
        #     return name == "UPDATE"
        return int(item.request_type_id or 0) == int(RequestType.UPDATE)

    # ---------------- Permissions ----------------
    def _ensure_user_can_edit_item(self, *, req: RequestModel, item: RequestItemModel, user_id: int, role_id: int) -> None:
        self._ensure_not_locked(item=item)

        if req.created_by != user_id:
            raise ForbiddenError("Acesso negado.")

        if int(item.request_status_id) != int(RequestStatus.RETURNED):
            raise ForbiddenError("Você só pode alterar quando a solicitação foi devolvida (RETURNED).")

    def _ensure_user_can_edit_field(
        self,
        *,
        req: RequestModel,
        item: RequestItemModel,
        user_id: int,
        role_id: int,
        field_tag: str,
    ) -> None:
        self._ensure_not_locked(item=item)

        # FINALIZED/REJECTED -> ninguém
        if int(item.request_status_id) in (int(RequestStatus.FINALIZED), int(RequestStatus.REJECTED)):
            raise ConflictError("Item FINALIZED/REJECTED não pode ser alterado.")

        # CREATE
        if self._is_create_item(item):
            # ADMIN/ANALYST: podem editar SOMENTE novo_codigo
            if role_id in (Role.ADMIN, Role.ANALYST):
                if field_tag == "novo_codigo":
                    return
                if (req.created_by == user_id and int(item.request_status_id) == int(RequestStatus.RETURNED)):
                    return
                raise ForbiddenError("Em CREATE, ADMIN/ANALYST podem editar apenas 'novo_codigo'.")

            # USER (criador) em RETURNED: pode editar campos do formulário, EXCETO novo_codigo
            if (
                role_id == Role.USER
                and req.created_by == user_id
                and int(item.request_status_id) == int(RequestStatus.RETURNED)
            ):
                if field_tag == "novo_codigo":
                    raise ForbiddenError("Em CREATE devolvido (RETURNED), o criador não pode editar 'novo_codigo'.")
                return

            raise ForbiddenError("Você não tem permissão para editar este campo em CREATE.")

        # UPDATE -> criador somente se RETURNED
        if self._is_update_item(item):
            if (
                req.created_by == user_id
                and int(item.request_status_id) == int(RequestStatus.RETURNED)
                and field_tag in ("novo_codigo", "codigo_atual")
            ):
                return
            raise ForbiddenError("Você só pode editar quando o status for RETURNED.")

        raise ForbiddenError("Você não tem permissão para editar este campo.")

    # ---------------- Small helpers ----------------
    def _touch_item(self, *, item_id: int) -> None:
        self._item_repo.touch_updated_at(int(item_id))

    def _get_field_value(self, item_fields: list[RequestItemFieldModel], tag: str) -> str | None:
        for f in item_fields:
            if str(f.field_tag) == str(tag) and not (f.is_deleted or False):
                v = (f.field_value or "").strip()
                return v or None
        return None

    def _validate_finalize_rules(
        self,
        *,
        item: RequestItemModel,
        item_fields: list[RequestItemFieldModel],
    ) -> None:
        codigo_atual = self._get_field_value(item_fields, "codigo_atual")
        novo_codigo = self._get_field_value(item_fields, "novo_codigo")

        if self._is_create_item(item):
            if not novo_codigo:
                raise ConflictError("Para finalizar CREATE, 'novo_codigo' é obrigatório.")
            return

        if self._is_update_item(item):
            if novo_codigo:
                return
            if not codigo_atual:
                raise ConflictError("Para finalizar UPDATE, informe 'codigo_atual' ou preencha 'novo_codigo'.")

    # ---------------- Listagem ----------------
    def list_request_items(
        self,
        *,
        user_id: int,
        role_id: int,
        limit: int,
        offset: int,
        status_id: Optional[int] = None,
        created_by_name: Optional[str] = None,
        type_id: Optional[int] = None,
        type_q: Optional[str] = None,
        item_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        date_mode: str = "AUTO",
    ) -> tuple[list[dict], int]:
        created_by_user_id: int | None = None
        if role_id == Role.USER:
            created_by_user_id = user_id
            created_by_name = None

        rows, total = self._item_repo.list_items_for_page(
            limit=limit,
            offset=offset,
            status_id=status_id,
            created_by_user_id=created_by_user_id,
            created_by_name=created_by_name,
            type_id=type_id,
            type_q=type_q,
            item_id=item_id,
            date_from=date_from,
            date_to=date_to,
            date_mode=date_mode,
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

    # ---------------- Status ----------------
    def change_item_status(self, *, item_id: int, new_status_id: int, user_id: int, role_id: int) -> None:
        self._ensure_can_change_status(role_id=role_id)

        item = self._item_repo.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        self._ensure_not_locked(item=item)

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

        if int(new_status_id) == int(RequestStatus.FINALIZED):
            fields_map = self._field_repo.list_by_item_ids([int(item.id)])
            item_fields = fields_map.get(int(item.id), [])
            self._validate_finalize_rules(item=item, item_fields=item_fields)

            prod_svc = ProductService(
                product_repo=self._product_repo,
                pfield_repo=self._pfield_repo,
                item_repo=self._item_repo,
            )
            prod_svc.apply_request_item_finalized(item=item, item_fields=item_fields)

        ok = self._item_repo.update_fields(item_id, {"request_status_id": int(new_status_id)})
        if not ok:
            raise NotFoundError("Item não encontrado.")

        item2 = self._item_repo.get_by_id(item_id) or item
        self._emit_item_changed(
            req=req,
            conversation_id=conversation_id,
            item=item2,
            changed_by=user_id,
            change_kind="STATUS",
        )

    # ---------------- NEW: Resubmit (explicit) ----------------
    def resubmit_returned_item(self, *, item_id: int, user_id: int, role_id: int) -> None:
        """
        Usuário finaliza suas edições e reenviar item RETURNED -> CREATED.
        Isso evita o bug de: ao editar 1 campo já mudar pra CREATED e bloquear as demais edições.
        """
        item = self._item_repo.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        if int(req.created_by) != int(user_id):
            raise ForbiddenError("Apenas o criador pode resubmeter este item.")

        # só permite resubmeter quando está RETURNED (caso contrário não faz sentido)
        if int(item.request_status_id) != int(RequestStatus.RETURNED):
            raise ConflictError("Só é possível resubmeter quando o status for RETURNED.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        ok = self._item_repo.update_fields(item_id, {"request_status_id": int(RequestStatus.CREATED)})
        if not ok:
            raise NotFoundError("Item não encontrado.")

        item2 = self._item_repo.get_by_id(item_id) or item
        self._emit_item_changed(
            req=req,
            conversation_id=conversation_id,
            item=item2,
            changed_by=user_id,
            change_kind="STATUS",
        )

    # ---------------- CRUD: Request ----------------
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
    ):
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

    # ---------------- CRUD: Item ----------------
    def add_item(self, *, request_id: int, user_id: int, role_id: int, payload: dict) -> RequestItemModel:
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

        self._ensure_user_can_edit_item(req=req, item=item, user_id=user_id, role_id=role_id)

        ok = self._item_repo.update_fields(item_id, values)
        if not ok:
            raise NotFoundError("Item não encontrado.")

        # ✅ NÃO muda status automaticamente (evita o bug de bloquear múltiplas edições)
        self._touch_item(item_id=item_id)

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

    # ---------------- CRUD: Field ----------------
    def add_field(self, *, item_id: int, user_id: int, role_id: int, payload: dict) -> RequestItemFieldModel:
        item = self._item_repo.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item não encontrado.")

        req = self._req_repo.get_by_id(item.request_id)
        if req is None:
            raise NotFoundError("Requisição não encontrada.")

        conversation_id = self._conversation_id_from_message(req.message_id)
        self._ensure_access_by_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        self._ensure_user_can_edit_field(
            req=req,
            item=item,
            user_id=user_id,
            role_id=role_id,
            field_tag=str(payload.get("field_tag") or ""),
        )

        field = RequestItemFieldModel(
            request_items_id=item.id,
            field_type_id=payload["field_type_id"],
            field_tag=payload["field_tag"],
            field_value=payload.get("field_value"),
            field_flag=payload.get("field_flag"),
        )
        created = self._field_repo.add(field)

        # ✅ não altera status automaticamente
        self._touch_item(item_id=int(item.id))
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

        self._ensure_user_can_edit_field(
            req=req,
            item=item,
            user_id=user_id,
            role_id=role_id,
            field_tag=str(field.field_tag),
        )

        # admin/analyst: só altera field_value
        if role_id in (Role.ADMIN, Role.ANALYST):
            values = {"field_value": values.get("field_value")}

        ok = self._field_repo.update_fields(field_id, values)
        if not ok:
            raise NotFoundError("Campo não encontrado.")

        # ✅ não altera status automaticamente; só atualiza updated_at do item
        self._touch_item(item_id=int(item.id))

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

        self._ensure_user_can_edit_field(
            req=req,
            item=item,
            user_id=user_id,
            role_id=role_id,
            field_tag=str(field.field_tag),
        )

        ok = self._field_repo.soft_delete(field_id)
        if not ok:
            raise NotFoundError("Campo não encontrado.")

        # ✅ não altera status automaticamente
        self._touch_item(item_id=int(item.id))
