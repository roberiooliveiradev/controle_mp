# app/api/routes/product_routes.py

from flask import Blueprint, jsonify, request
from app.api.middlewares.auth_middleware import require_auth
from app.infrastructure.database.session import db_session

from app.api.schemas.product_schema import (
    ProductListResponse,
    ProductListRowResponse,
    ProductResponse,
    ProductFieldResponse,
)

from app.services.product_query_service import ProductQueryService

bp_products = Blueprint("products", __name__, url_prefix="/api/products")

@bp_products.get("")
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


@bp_products.get("/<int:product_id>")
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
