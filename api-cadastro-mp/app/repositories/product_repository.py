# app/repositories/product_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.product_model import ProductModel

class ProductRepository(BaseRepository[ProductModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: ProductModel) -> ProductModel:
        self._session.add(model)
        self._session.flush()
        return model

    def get_by_id(self, product_id: int) -> ProductModel | None:
        stmt = select(ProductModel).where(
            ProductModel.id == int(product_id),
            ProductModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def touch_updated_at(self, product_id: int) -> bool:
        stmt = (
            update(ProductModel)
            .where(ProductModel.id == int(product_id), ProductModel.is_deleted.is_(False))
            .values(updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0
