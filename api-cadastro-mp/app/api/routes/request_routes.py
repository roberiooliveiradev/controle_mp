# app/api/routes/request_routes.py

from __future__ import annotations

from datetime import date
from flask import Blueprint, jsonify, g, request

from app.api.middlewares.auth_middleware import require_auth
from app.api.schemas.request_schema import (
    CreateRequestInput,
    CreateRequestItemInput,
    UpdateRequestItemInput,
    CreateRequestItemFieldInput,
    UpdateRequestItemFieldInput,
    RequestResponse,
    RequestItemResponse,
    RequestItemFieldResponse,
    RequestItemListResponse,
    RequestItemListRowResponse,
    RequestTypeMiniResponse,
    RequestStatusMiniResponse,
    RequestMetaResponse,
)

from app.infrastructure.database.session import db_session

from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.request_repository import RequestRepository
from app.repositories.request_item_repository import RequestItemRepository
from app.repositories.request_item_field_repository import RequestItemFieldRepository
from app.repositories.request_status_repository import RequestStatusRepository
from app.repositories.request_type_repository import RequestTypeRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.product_field_repository import ProductFieldRepository

from app.services.request_service import RequestService

from app.services.audit_service import AuditService
from app.repositories.audit_log_repository import AuditLogRepository

from app.infrastructure.realtime.socketio_request_notifier import SocketIORequestNotifier

from app.core.audit.audit_entities import AuditEntity
from app.core.audit.audit_actions import AuditAction

bp_req = Blueprint("requests", __name__, url_prefix="/api/requests")


# -------------------------
# Helpers
# -------------------------

def _auth_user() -> tuple[int, int]:
    auth = getattr(g, "auth", None)
    return int(auth["sub"]), int(auth["role_id"])


def _build_service(session) -> RequestService:
    return RequestService(
        conv_repo=ConversationRepository(session),
        msg_repo=MessageRepository(session),
        req_repo=RequestRepository(session),
        item_repo=RequestItemRepository(session),
        field_repo=RequestItemFieldRepository(session),
        status_repo=RequestStatusRepository(session),
        type_repo=RequestTypeRepository(session),
        product_repo=ProductRepository(session),
        pfield_repo=ProductFieldRepository(session),
        notifier=SocketIORequestNotifier(),
    )


def _build_audit(session) -> AuditService:
    return AuditService(AuditLogRepository(session))


def _keys_of(d: dict) -> list[str]:
    return sorted([str(k) for k in d.keys()])


def _pack_request(req, items, fields_map, type_map, status_map) -> dict:
    return RequestResponse(
        id=req.id,
        message_id=req.message_id,
        created_by=req.created_by,
        created_at=req.created_at,
        updated_at=req.updated_at,
        items=[
            RequestItemResponse(
                id=i.id,
                request_id=i.request_id,
                request_type_id=i.request_type_id,
                request_status_id=i.request_status_id,
                request_type=(
                    RequestTypeMiniResponse(
                        id=type_map[i.request_type_id].id,
                        type_name=type_map[i.request_type_id].type_name,
                    )
                    if type_map.get(i.request_type_id) is not None
                    else None
                ),
                request_status=(
                    RequestStatusMiniResponse(
                        id=status_map[i.request_status_id].id,
                        status_name=status_map[i.request_status_id].status_name,
                    )
                    if status_map.get(i.request_status_id) is not None
                    else None
                ),
                product_id=i.product_id,
                created_at=i.created_at,
                updated_at=i.updated_at,
                fields=[
                    RequestItemFieldResponse(
                        id=f.id,
                        request_items_id=f.request_items_id,
                        field_type_id=f.field_type_id,
                        field_tag=f.field_tag,
                        field_value=f.field_value,
                        field_flag=f.field_flag,
                        created_at=f.created_at,
                        updated_at=f.updated_at,
                    )
                    for f in fields_map.get(i.id, [])
                ],
            )
            for i in items
        ],
    ).model_dump()


def _parse_date_yyyy_mm_dd(s: str | None) -> date | None:
    if not s:
        return None
    try:
        y, m, d = s.split("-")
        return date(int(y), int(m), int(d))
    except Exception:
        return None


# -------------------------
# Request CRUD
# -------------------------

@bp_req.post("")
@require_auth
def create_request():
    user_id, role_id = _auth_user()
    payload = CreateRequestInput.model_validate(request.get_json(force=True))

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        req = svc.create_request(
            message_id=payload.message_id,
            created_by=user_id,
            role_id=role_id,
            items=[i.model_dump() for i in payload.items],
        )

        req2, items, fields_map, type_map, status_map = svc.get_request(
            request_id=req.id, user_id=user_id, role_id=role_id
        )

        audit.log(
            entity_name=AuditEntity.REQUEST,
            entity_id=req.id,
            action_name=AuditAction.CREATED,
            user_id=user_id,
            details=f"message_id={payload.message_id}; items_count={len(payload.items)}",
        )

    return jsonify(_pack_request(req2, items, fields_map, type_map, status_map)), 201


@bp_req.get("/<int:request_id>")
@require_auth
def get_request(request_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = _build_service(session)
        req, items, fields_map, type_map, status_map = svc.get_request(
            request_id=request_id, user_id=user_id, role_id=role_id
        )

    return jsonify(_pack_request(req, items, fields_map, type_map, status_map)), 200


@bp_req.delete("/<int:request_id>")
@require_auth
def delete_request(request_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.delete_request(request_id=request_id,
                           user_id=user_id, role_id=role_id)

        audit.log(
            entity_name=AuditEntity.REQUEST,
            entity_id=request_id,
            action_name=AuditAction.DELETED,
            user_id=user_id,
            details="request deleted",
        )

    return ("", 204)


# -------------------------
# Items CRUD
# -------------------------

@bp_req.post("/<int:request_id>/items")
@require_auth
def add_item(request_id: int):
    user_id, role_id = _auth_user()
    payload = CreateRequestItemInput.model_validate(
        request.get_json(force=True))

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        it = svc.add_item(
            request_id=request_id,
            user_id=user_id,
            role_id=role_id,
            payload=payload.model_dump(),
        )

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM,
            entity_id=it.id,
            action_name=AuditAction.CREATED,
            user_id=user_id,
            details=f"request_id={request_id}; keys={_keys_of(payload.model_dump())}",
        )

    return jsonify({"id": it.id}), 201


@bp_req.patch("/items/<int:item_id>")
@require_auth
def update_item(item_id: int):
    user_id, role_id = _auth_user()
    payload = UpdateRequestItemInput.model_validate(
        request.get_json(force=True))

    values = {k: v for k, v in payload.model_dump().items() if v is not None}

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.update_item(item_id=item_id, user_id=user_id,
                        role_id=role_id, values=values)

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM,
            entity_id=item_id,
            action_name=AuditAction.UPDATED,
            user_id=user_id,
            details=f"changed_keys={_keys_of(values)}",
        )

    return ("", 204)


@bp_req.delete("/items/<int:item_id>")
@require_auth
def delete_item(item_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.delete_item(item_id=item_id, user_id=user_id, role_id=role_id)

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM,
            entity_id=item_id,
            action_name=AuditAction.DELETED,
            user_id=user_id,
            details="item deleted",
        )

    return ("", 204)


# -------------------------
# Resubmit (explicit)
# -------------------------

@bp_req.patch("/items/<int:item_id>/resubmit")
@require_auth
def resubmit_item(item_id: int):
    """
    O USER usa esta rota ao terminar de editar um item RETURNED,
    para reenviar (RETURNED -> CREATED).
    """
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.resubmit_returned_item(
            item_id=item_id, user_id=user_id, role_id=role_id)

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM,
            entity_id=item_id,
            action_name=AuditAction.STATUS_CHANGED,
            user_id=user_id,
            details="resubmit (RETURNED -> CREATED)",
        )

    return ("", 204)


# -------------------------
# Fields CRUD
# -------------------------

@bp_req.post("/items/<int:item_id>/fields")
@require_auth
def add_field(item_id: int):
    user_id, role_id = _auth_user()
    payload = CreateRequestItemFieldInput.model_validate(
        request.get_json(force=True))

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        f = svc.add_field(
            item_id=item_id,
            user_id=user_id,
            role_id=role_id,
            payload=payload.model_dump(),
        )

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM_FIELD,
            entity_id=f.id,
            action_name=AuditAction.CREATED,
            user_id=user_id,
            details=f"item_id={item_id}; field_tag={payload.field_tag}",
        )

    return jsonify({"id": f.id}), 201


@bp_req.patch("/fields/<int:field_id>")
@require_auth
def update_field(field_id: int):
    user_id, role_id = _auth_user()
    payload = UpdateRequestItemFieldInput.model_validate(
        request.get_json(force=True))

    values = {k: v for k, v in payload.model_dump().items() if v is not None}

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.update_field(field_id=field_id, user_id=user_id,
                         role_id=role_id, values=values)

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM_FIELD,
            entity_id=field_id,
            action_name=AuditAction.UPDATED,
            user_id=user_id,
            details=f"changed_keys={_keys_of(values)}",
        )

    return ("", 204)


@bp_req.patch("/fields/<int:field_id>/flag")
@require_auth
def set_field_flag(field_id: int):
    user_id, role_id = _auth_user()
    body = request.get_json(force=True) or {}

    flag = body.get("field_flag")
    if flag is not None:
        flag = str(flag).strip() or None

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.set_field_flag(field_id=int(field_id),
                           user_id=user_id, role_id=role_id, field_flag=flag)

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM_FIELD,
            entity_id=field_id,
            action_name=AuditAction.UPDATED,
            user_id=user_id,
            details=f"field_flag={flag}",
        )

    return ("", 204)


@bp_req.delete("/fields/<int:field_id>")
@require_auth
def delete_field(field_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.delete_field(field_id=field_id, user_id=user_id, role_id=role_id)

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM_FIELD,
            entity_id=field_id,
            action_name=AuditAction.DELETED,
            user_id=user_id,
            details="field deleted",
        )

    return ("", 204)


# -------------------------
# Listagem (tela)
# -------------------------

@bp_req.get("/items")
@require_auth
def list_request_items():
    user_id, role_id = _auth_user()

    try:
        limit = int(request.args.get("limit", 30))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({"error": "Parâmetros limit/offset inválidos."}), 400

    status_id = request.args.get("status_id")
    status_id = int(
        status_id) if status_id is not None and status_id != "" else None

    created_by_name = (request.args.get(
        "created_by_name") or "").strip() or None

    type_id = request.args.get("type_id")
    type_id = int(type_id) if type_id is not None and type_id != "" else None
    type_q = (request.args.get("type_q") or "").strip() or None

    item_id = request.args.get("item_id")
    item_id = int(item_id) if item_id is not None and item_id != "" else None

    date_mode = (request.args.get("date_mode") or "AUTO").strip().upper()
    if date_mode not in ("AUTO", "CREATED", "UPDATED"):
        return jsonify({"error": "date_mode inválido. Use: AUTO | CREATED | UPDATED"}), 400

    date_from = _parse_date_yyyy_mm_dd(request.args.get("date_from"))
    date_to = _parse_date_yyyy_mm_dd(request.args.get("date_to"))
    if (request.args.get("date_from") and date_from is None) or (request.args.get("date_to") and date_to is None):
        return jsonify({"error": "date_from/date_to inválidos. Use YYYY-MM-DD."}), 400

    with db_session() as session:
        svc = _build_service(session)
        rows, total = svc.list_request_items(
            user_id=user_id,
            role_id=role_id,
            limit=limit,
            offset=offset,
            status_id=status_id,
            created_by_name=created_by_name,
            type_id=type_id,
            type_q=type_q,
            item_id=item_id,
            date_from=date_from,
            date_to=date_to,
            date_mode=date_mode,
        )

    payload = RequestItemListResponse(
        items=[RequestItemListRowResponse(**r) for r in rows],
        total=int(total),
        limit=limit,
        offset=offset,
    ).model_dump()

    return jsonify(payload), 200


# -------------------------
# Status change
# -------------------------

@bp_req.patch("/items/<int:item_id>/status")
@require_auth
def change_item_status(item_id: int):
    user_id, role_id = _auth_user()
    body = request.get_json(force=True) or {}
    new_status_id = body.get("request_status_id")

    if new_status_id is None:
        return jsonify({"error": "Campo obrigatório: request_status_id"}), 400

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        product_event = svc.change_item_status(
            item_id=item_id,
            new_status_id=int(new_status_id),
            user_id=user_id,
            role_id=role_id,
        )

        audit.log(
            entity_name=AuditEntity.REQUEST_ITEM,
            entity_id=item_id,
            action_name=AuditAction.STATUS_CHANGED,
            user_id=user_id,
            details=f"new_status_id={int(new_status_id)}",
        )

        if product_event:
            product_id = int(product_event["product_id"])
            created = bool(product_event["created"])

            audit.log(
                entity_name=AuditEntity.PRODUCT,
                entity_id=product_id,
                action_name=AuditAction.CREATED if created else AuditAction.UPDATED,
                user_id=user_id,
                details=(
                    f"via=RequestItemFinalized; item_id={item_id}; "
                    f"codigo_atual={product_event.get('codigo_atual')}; "
                    f"descricao={product_event.get('descricao')}"
                ),
            )

    return ("", 204)


# -------------------------
# Meta
# -------------------------

@bp_req.get("/meta")
@require_auth
def get_requests_meta():
    with db_session() as session:
        type_repo = RequestTypeRepository(session)
        status_repo = RequestStatusRepository(session)

        types = type_repo.list_active()
        statuses = status_repo.list_active()

    payload = RequestMetaResponse(
        types=[{"id": int(t.id), "type_name": t.type_name} for t in types],
        statuses=[{"id": int(s.id), "status_name": s.status_name}
                  for s in statuses],
    ).model_dump()

    return jsonify(payload), 200
