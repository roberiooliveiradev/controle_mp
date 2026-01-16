# app/repositories/request_item_field_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.request_item_field_model import RequestItemFieldModel
from app.infrastructure.database.models.request_item_model import RequestItemModel

class RequestItemFieldRepository(BaseRepository[RequestItemFieldModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: RequestItemFieldModel) -> RequestItemFieldModel:
        self._session.add(model)
        self._session.flush()
        return model

    def add_many(self, models: list[RequestItemFieldModel]) -> None:
        self._session.add_all(models)
        self._session.flush()

    def get_by_id(self, field_id: int) -> RequestItemFieldModel | None:
        stmt = select(RequestItemFieldModel).where(
            RequestItemFieldModel.id == field_id,
            RequestItemFieldModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def list_by_item_ids(self, item_ids: list[int]) -> dict[int, list[RequestItemFieldModel]]:
        if not item_ids:
            return {}

        stmt = (
            select(RequestItemFieldModel)
            .where(
                RequestItemFieldModel.request_items_id.in_(item_ids),
                RequestItemFieldModel.is_deleted.is_(False),
            )
            .order_by(RequestItemFieldModel.id.asc())
        )
        rows = list(self._session.execute(stmt).scalars().all())

        grouped: dict[int, list[RequestItemFieldModel]] = {}
        for f in rows:
            grouped.setdefault(f.request_items_id, []).append(f)
        return grouped

    def update_fields(self, field_id: int, values: dict) -> bool:
        if not values:
            return True
        stmt = (
            update(RequestItemFieldModel)
            .where(RequestItemFieldModel.id == field_id, RequestItemFieldModel.is_deleted.is_(False))
            .values(**values, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def soft_delete(self, field_id: int) -> bool:
        stmt = (
            update(RequestItemFieldModel)
            .where(RequestItemFieldModel.id == field_id, RequestItemFieldModel.is_deleted.is_(False))
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0
    
    def soft_delete_by_request_id(self, request_id: int) -> int:
        # pega ids dos itens da request (subquery)
        item_ids_subq = (
            select(RequestItemModel.id)
            .where(
                RequestItemModel.request_id == request_id,
                RequestItemModel.is_deleted.is_(False),
            )
            .subquery()
        )

        stmt = (
            update(RequestItemFieldModel)
            .where(
                RequestItemFieldModel.request_items_id.in_(select(item_ids_subq.c.id)),
                RequestItemFieldModel.is_deleted.is_(False),
            )
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return int(res.rowcount or 0)