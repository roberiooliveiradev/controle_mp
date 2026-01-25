# app/repositories/product_field_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.product_field_model import ProductFieldModel


class ProductFieldRepository(BaseRepository[ProductFieldModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add_many(self, models: list[ProductFieldModel]) -> None:
        self._session.add_all(models)
        self._session.flush()

    def get_by_id(self, field_id: int) -> ProductFieldModel | None:
        stmt = select(ProductFieldModel).where(
            ProductFieldModel.id == int(field_id),
            ProductFieldModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def list_by_product_id(self, product_id: int) -> list[ProductFieldModel]:
        stmt = (
            select(ProductFieldModel)
            .where(
                ProductFieldModel.product_id == int(product_id),
                ProductFieldModel.is_deleted.is_(False),
            )
            .order_by(ProductFieldModel.id.asc())
        )
        return list(self._session.execute(stmt).scalars().all())

    def get_by_product_and_tag(self, product_id: int, tag: str) -> ProductFieldModel | None:
        stmt = select(ProductFieldModel).where(
            ProductFieldModel.product_id == int(product_id),
            ProductFieldModel.field_tag == str(tag),
            ProductFieldModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def update_field(self, field_id: int, values: dict) -> bool:
        if not values:
            return True
        stmt = (
            update(ProductFieldModel)
            .where(ProductFieldModel.id == int(field_id), ProductFieldModel.is_deleted.is_(False))
            .values(**values, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def find_product_id_by_any_code(
        self,
        *,
        codigo_atual: str | None,
        novo_codigo: str | None,
    ) -> int | None:
        codes = [c.strip() for c in (codigo_atual, novo_codigo) if c and c.strip()]
        if not codes:
            return None

        stmt = (
            select(ProductFieldModel.product_id)
            .where(
                ProductFieldModel.is_deleted.is_(False),
                ProductFieldModel.field_tag == "codigo_atual",
                ProductFieldModel.field_value.in_(codes),
            )
            .order_by(ProductFieldModel.product_id.asc())
            .limit(1)
        )

        return self._session.execute(stmt).scalar()

    def find_product_id_by_codigo_atual(self, *, codigo_atual: str | None) -> int | None:
        code = (codigo_atual or "").strip()
        if not code:
            return None

        stmt = (
            select(ProductFieldModel.product_id)
            .where(
                ProductFieldModel.is_deleted.is_(False),
                ProductFieldModel.field_tag == "codigo_atual",
                ProductFieldModel.field_value == code,
            )
            .limit(1)
        )
        return self._session.execute(stmt).scalar()
