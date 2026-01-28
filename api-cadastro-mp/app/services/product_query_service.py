# app/services/product_query_service.py
from datetime import datetime, timedelta
from sqlalchemy import select, func, exists, and_
from sqlalchemy.orm import Session

import json

from app.core.exceptions import NotFoundError, ConflictError
from app.infrastructure.database.models.product_model import ProductModel
from app.infrastructure.database.models.product_field_model import ProductFieldModel

from app.repositories.totvs_product_repository import TotvsProductRepository

class ProductQueryService:
    def __init__(self, session: Session, totvs_prod_repo: TotvsProductRepository) -> None:
        self._session = session
        self._totvs_prod_repo = totvs_prod_repo

    def _parse_date(self, s: str) -> datetime:
        # aceita YYYY-MM-DD
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except Exception:
            raise ConflictError("Data inválida. Use o formato YYYY-MM-DD.")

    def list_products(
        self,
        *,
        limit: int,
        offset: int,
        q: str | None,
        flag: str = "all",  # all | with | without
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> tuple[list[dict], int]:

        base = select(ProductModel).where(ProductModel.is_deleted.is_(False))

        # ✅ filtro por flag no SQL (antes de paginar)
        flag_predicate = exists(
            select(1).where(
                and_(
                    ProductFieldModel.product_id == ProductModel.id,
                    ProductFieldModel.is_deleted.is_(False),
                    ProductFieldModel.field_flag.is_not(None),
                    ProductFieldModel.field_flag != "",
                )
            )
        )

        if flag == "with":
            base = base.where(flag_predicate)
        elif flag == "without":
            base = base.where(~flag_predicate)

        # filtro por data (coalesce(updated_at, created_at))
        if date_from:
            dt_from = self._parse_date(date_from)
            base = base.where(func.coalesce(ProductModel.updated_at, ProductModel.created_at) >= dt_from)

        if date_to:
            dt_to = self._parse_date(date_to) + timedelta(days=1)  # exclusivo no próximo dia
            base = base.where(func.coalesce(ProductModel.updated_at, ProductModel.created_at) < dt_to)

        total_stmt = select(func.count()).select_from(base.subquery())
        total = int(self._session.execute(total_stmt).scalar_one())

        page = (
            base.order_by(
                func.coalesce(ProductModel.updated_at, ProductModel.created_at).desc(),
                ProductModel.id.desc(),
            )
            .limit(int(limit))
            .offset(int(offset))
        )

        products = list(self._session.execute(page).scalars().all())
        pids = [int(p.id) for p in products]

        # campos básicos
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

        # contagem de flags por produto
        flags_by_pid: dict[int, int] = {}
        if pids:
            flags_stmt = (
                select(ProductFieldModel.product_id, func.count(ProductFieldModel.id))
                .where(
                    ProductFieldModel.product_id.in_(pids),
                    ProductFieldModel.is_deleted.is_(False),
                    ProductFieldModel.field_flag.is_not(None),
                    ProductFieldModel.field_flag != "",
                )
                .group_by(ProductFieldModel.product_id)
            )
            for product_id, total_flags in self._session.execute(flags_stmt).all():
                flags_by_pid[int(product_id)] = int(total_flags)

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
                    "flags_count": flags_by_pid.get(int(p.id), 0),
                }
            )

        # filtro client-side por q (mantido)
        if q and q.strip():
            qq = q.strip().lower()
            rows = [
                r
                for r in rows
                if (r.get("codigo_atual") or "").lower().find(qq) >= 0
                or (r.get("descricao") or "").lower().find(qq) >= 0
            ]

        return rows, total

    def get_product(self, *, product_id: int):
        p = (
            self._session.execute(
                select(ProductModel).where(ProductModel.id == int(product_id), ProductModel.is_deleted.is_(False))
            )
            .scalars()
            .first()
        )
        if p is None:
            raise NotFoundError("Produto não encontrado.")

        fields = list(
            self._session.execute(
                select(ProductFieldModel)
                .where(ProductFieldModel.product_id == int(product_id), ProductFieldModel.is_deleted.is_(False))
                .order_by(ProductFieldModel.id.asc())
            )
            .scalars()
            .all()
        )
        return p, fields
    
    def get_product_totvs(self, *, product_code: str) -> dict:
        code = (product_code or "").strip()
        if not code:
            raise NotFoundError("Código do produto não informado.")

        rows = self._totvs_prod_repo.list_products(code=code)
        if not rows:
            raise NotFoundError("Produto não encontrado no TOTVS.")

        item = rows[0]

        # 'fornecedores' vem como JSON string (FOR JSON PATH). Vamos normalizar.
        fornecedores_raw = item.get("fornecedores")
        if isinstance(fornecedores_raw, str) and fornecedores_raw.strip():
            try:
                item["fornecedores"] = json.loads(fornecedores_raw)
            except Exception:
                # se vier inválido, mantém como string para não estourar 500
                pass
        elif fornecedores_raw in (None, "", "null"):
            item["fornecedores"] = []

        return item
