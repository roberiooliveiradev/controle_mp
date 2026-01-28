# app/api/routes/product_routes.py

from __future__ import annotations

from flask import Blueprint, jsonify, request, g

from app.api.middlewares.auth_middleware import require_auth
from app.infrastructure.database.session import db_session

from app.repositories.product_repository import ProductRepository
from app.repositories.product_field_repository import ProductFieldRepository
from app.repositories.request_item_repository import RequestItemRepository
from app.repositories.totvs_product_repository import TotvsProductRepository

from app.services.product_service import ProductService
from app.services.product_query_service import ProductQueryService

from app.api.schemas.product_schema import (
    ProductListResponse,
    ProductListRowResponse,
    ProductResponse,
    ProductFieldResponse,
)

from app.infrastructure.realtime.socketio_product_notifier import SocketIOProductNotifier

from app.services.audit_service import AuditService
from app.repositories.audit_log_repository import AuditLogRepository

from app.core.audit.audit_entities import AuditEntity
from app.core.audit.audit_actions import AuditAction

bp_prod = Blueprint("products", __name__, url_prefix="/api/products")


# -------------------------
# Helpers
# -------------------------

def _auth_user() -> tuple[int, int]:
    auth = getattr(g, "auth", None)
    return int(auth["sub"]), int(auth["role_id"])


def _build_service(session) -> ProductService:
    return ProductService(
        product_repo=ProductRepository(session),
        pfield_repo=ProductFieldRepository(session),
        item_repo=RequestItemRepository(session),
        product_notifier=SocketIOProductNotifier(),
    )

def _build_query_service(session) -> ProductQueryService:
    return ProductQueryService(
        session,
        totvs_prod_repo=TotvsProductRepository(),
    )


def _build_audit(session) -> AuditService:
    return AuditService(AuditLogRepository(session))


# -------------------------
# Rotas (consulta)
# -------------------------

@bp_prod.get("")
@require_auth
def list_products():
    try:
        limit = int(request.args.get("limit", 30))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({"error": "Parâmetros limit/offset inválidos."}), 400

    q = (request.args.get("q") or "").strip() or None

    flag_mode = (request.args.get("flag") or "all").strip().lower()
    if flag_mode not in ("all", "with", "without"):
        return jsonify({"error": "Parâmetro flag inválido. Use: all | with | without"}), 400

    date_from = (request.args.get("date_from") or "").strip() or None
    date_to = (request.args.get("date_to") or "").strip() or None

    with db_session() as session:
        svc = _build_query_service(session)
        rows, total = svc.list_products(
            limit=limit,
            offset=offset,
            q=q,
            flag=flag_mode,
            date_from=date_from,
            date_to=date_to,
        )

    payload = ProductListResponse(
        items=[ProductListRowResponse(**r) for r in rows],
        total=int(total),
        limit=limit,
        offset=offset,
    ).model_dump()

    return jsonify(payload), 200


@bp_prod.get("/<int:product_id>")
@require_auth
def get_product(product_id: int):
    with db_session() as session:
        svc = _build_query_service(session)
        p, fields = svc.get_product(product_id=product_id)

    payload = ProductResponse(
        id=int(p.id),
        created_at=p.created_at,
        updated_at=p.updated_at,
        fields=[
            ProductFieldResponse(
                id=int(f.id),
                product_id=int(f.product_id),
                field_type_id=int(f.field_type_id),
                field_tag=f.field_tag,
                field_value=f.field_value,
                field_flag=f.field_flag,
                created_at=f.created_at,
                updated_at=f.updated_at,
            )
            for f in fields
        ],
    ).model_dump()

    return jsonify(payload), 200


# -------------------------
# Rotas (mutação) + Auditoria
# -------------------------

@bp_prod.patch("/fields/<int:field_id>/flag")
@require_auth
def set_product_field_flag(field_id: int):
    """
    Atualiza o flag do campo do produto.
    Auditoria: registra FLAG_UPDATED em tbProductFields.
    """
    user_id, role_id = _auth_user()
    body = request.get_json(force=True) or {}

    flag = body.get("field_flag")
    if flag is not None:
        flag = str(flag).strip() or None

    with db_session() as session:
        svc = _build_service(session)
        audit = _build_audit(session)

        svc.set_product_field_flag(
            field_id=int(field_id),
            role_id=role_id,
            changed_by=int(user_id),
            field_flag=flag,
        )

        audit.log(
            entity_name=AuditEntity.PRODUCT_FIELD,
            entity_id=int(field_id),
            action_name=AuditAction.UPDATED,
            user_id=int(user_id),
            details=f"field_flag={flag}",
        )

    return ("", 204)

@bp_prod.get("/<int:product_id>/totvs")
@require_auth
def get_product_totvs(product_id: int):
    with db_session() as session:
        svc = _build_query_service(session)
        p, fields = svc.get_product(product_id=product_id)

        codigo_atual = None
        for f in fields:
            if f.field_tag == "codigo_atual":
                codigo_atual = (f.field_value or "").strip()
                break

        if not codigo_atual:
            return jsonify({"error": "Produto não possui campo 'codigo_atual' preenchido."}), 409

        totvs = svc.get_product_totvs(product_code=codigo_atual)

    return jsonify({"product_id": int(p.id), "codigo_atual": codigo_atual, "totvs": totvs}), 200

@bp_prod.get("/totvs/<product_code>")
@require_auth
def get_product_by_code_totvs(product_code: str):
    with db_session() as session:
        svc = _build_query_service(session)

        totvs = svc.get_product_totvs(product_code=product_code)

        if not totvs:
            return jsonify({"error": "Produto não encontrado."}), 409

    return jsonify({"totvs": totvs}), 200

