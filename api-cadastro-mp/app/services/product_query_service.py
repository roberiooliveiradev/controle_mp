# app/services/product_query_service.py

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.infrastructure.database.models.product_model import ProductModel
from app.infrastructure.database.models.product_field_model import ProductFieldModel

class ProductQueryService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_products(self, *, limit: int, offset: int, q: str | None) -> tuple[list[dict], int]:
        base = select(ProductModel).where(ProductModel.is_deleted.is_(False))
        total_stmt = select(func.count()).select_from(base.subquery())
        total = int(self._session.execute(total_stmt).scalar_one())

        page = (
            base.order_by(func.coalesce(ProductModel.updated_at, ProductModel.created_at).desc(), ProductModel.id.desc())
            .limit(int(limit))
            .offset(int(offset))
        )
        products = list(self._session.execute(page).scalars().all())

        # busca fields apenas para preencher codigo_atual/descricao na listagem (simples)
        pids = [int(p.id) for p in products]
        fields = []
        if pids:
            stmtf = (
                select(ProductFieldModel)
                .where(
                    ProductFieldModel.product_id.in_(pids),
                    ProductFieldModel.is_deleted.is_(False),
                    ProductFieldModel.field_tag.in_(["codigo_atual", "descricao"]),
                )
            )
            fields = list(self._session.execute(stmtf).scalars().all())

        by_pid = {}
        for f in fields:
            by_pid.setdefault(int(f.product_id), {})[f.field_tag] = f.field_value

        rows = []
        for p in products:
            d = by_pid.get(int(p.id), {})
            rows.append(
                {
                    "id": int(p.id),
                    "created_at": p.created_at,
                    "updated_at": p.updated_at,
                    "codigo_atual": d.get("codigo_atual"),
                    "descricao": d.get("descricao"),
                }
            )

        # filtro q (client-side simples). Se quiser server-side, dá pra evoluir depois.
        if q and q.strip():
            qq = q.strip().lower()
            rows = [r for r in rows if (r.get("codigo_atual") or "").lower().find(qq) >= 0 or (r.get("descricao") or "").lower().find(qq) >= 0]

        return rows, total

    def get_product(self, *, product_id: int) -> tuple[ProductModel, list[ProductFieldModel]]:
        p = self._session.execute(
            select(ProductModel).where(ProductModel.id == int(product_id), ProductModel.is_deleted.is_(False))
        ).scalars().first()
        if p is None:
            raise NotFoundError("Produto não encontrado.")

        fields = list(
            self._session.execute(
                select(ProductFieldModel)
                .where(ProductFieldModel.product_id == int(product_id), ProductFieldModel.is_deleted.is_(False))
                .order_by(ProductFieldModel.id.asc())
            ).scalars().all()
        )
        return p, fields
