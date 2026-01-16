# app/repositories/request_item_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.request_item_model import RequestItemModel


class RequestItemRepository(BaseRepository[RequestItemModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: RequestItemModel) -> RequestItemModel:
        self._session.add(model)
        self._session.flush()
        return model

    def get_by_id(self, item_id: int) -> RequestItemModel | None:
        stmt = select(RequestItemModel).where(
            RequestItemModel.id == item_id,
            RequestItemModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def list_by_request_id(self, request_id: int) -> list[RequestItemModel]:
        stmt = (
            select(RequestItemModel)
            .where(RequestItemModel.request_id == request_id, RequestItemModel.is_deleted.is_(False))
            .order_by(RequestItemModel.id.asc())
        )
        return list(self._session.execute(stmt).scalars().all())

    def update_fields(self, item_id: int, values: dict) -> bool:
        if not values:
            return True
        stmt = (
            update(RequestItemModel)
            .where(RequestItemModel.id == item_id, RequestItemModel.is_deleted.is_(False))
            .values(**values, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def soft_delete(self, item_id: int) -> bool:
        stmt = (
            update(RequestItemModel)
            .where(RequestItemModel.id == item_id, RequestItemModel.is_deleted.is_(False))
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0
    def soft_delete_by_request_id(self, request_id: int) -> int:
        stmt = (
            update(RequestItemModel)
            .where(
                RequestItemModel.request_id == request_id,
                RequestItemModel.is_deleted.is_(False),
            )
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return int(res.rowcount or 0)