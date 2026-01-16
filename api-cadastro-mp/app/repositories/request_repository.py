# app/repositories/request_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.request_model import RequestModel


class RequestRepository(BaseRepository[RequestModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: RequestModel) -> RequestModel:
        self._session.add(model)
        self._session.flush()
        return model

    def get_by_id(self, request_id: int) -> RequestModel | None:
        stmt = select(RequestModel).where(
            RequestModel.id == request_id,
            RequestModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def get_by_message_id(self, message_id: int) -> RequestModel | None:
        stmt = select(RequestModel).where(
            RequestModel.message_id == message_id,
            RequestModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def soft_delete(self, request_id: int) -> bool:
        stmt = (
            update(RequestModel)
            .where(RequestModel.id == request_id, RequestModel.is_deleted.is_(False))
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0
