# app/api/routes/product_routes.py

from flask import Blueprint, jsonify, request, g

from app.repositories.product_repository import ProductRepository
from app.repositories.product_field_repository import ProductFieldRepository
from app.repositories.request_item_repository import RequestItemRepository
from app.services.product_service import ProductService

from app.api.middlewares.auth_middleware import require_auth
from app.infrastructure.database.session import db_session

from app.api.schemas.product_schema import (
    ProductListResponse,
    ProductListRowResponse,
    ProductResponse,
    ProductFieldResponse,
)

from app.services.product_query_service import ProductQueryService


bp_prod = Blueprint("products", __name__, url_prefix="/api/products")


def _auth_user():
    auth = getattr(g, "auth", None)
    return int(auth["sub"]), int(auth["role_id"])


def _build_service(session) -> ProductService:
    return ProductService(
        product_repo=ProductRepository(session),
        pfield_repo=ProductFieldRepository(session),
        item_repo=RequestItemRepository(session),
    )



@bp_prod.get("")
@require_auth
def list_products():
    try:
        limit = int(request.args.get("limit", 30))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({"error": "Parâmetros limit/offset inválidos."}), 400

    q = (request.args.get("q") or "").strip() or None

    with db_session() as session:
        svc = ProductQueryService(session)
        rows, total = svc.list_products(limit=limit, offset=offset, q=q)

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
        svc = ProductQueryService(session)
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


@bp_prod.patch("/fields/<int:field_id>/flag")
@require_auth
def set_product_field_flag(field_id: int):
    _user_id, role_id = _auth_user()
    body = request.get_json(force=True) or {}

    flag = body.get("field_flag")
    if flag is not None:
        flag = str(flag).strip() or None

    with db_session() as session:
        svc = _build_service(session)
        svc.set_product_field_flag(field_id=int(field_id), role_id=role_id, field_flag=flag)

    return ("", 204)
