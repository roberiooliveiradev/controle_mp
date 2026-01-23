# app/repositories/request_status_repository.py

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.request_status_model import RequestStatusModel


class RequestStatusRepository(BaseRepository[RequestStatusModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def get_map_by_ids(self, ids: list[int]) -> dict[int, RequestStatusModel]:
        ids = [int(x) for x in ids if x is not None]
        if not ids:
            return {}

        stmt = select(RequestStatusModel).where(
            RequestStatusModel.id.in_(ids),
            RequestStatusModel.is_deleted.is_(False),
        )
        rows = list(self._session.execute(stmt).scalars().all())
        return {int(r.id): r for r in rows}

    def list_active(self) -> list[RequestStatusModel]:
        stmt = (
            select(RequestStatusModel)
            .where(RequestStatusModel.is_deleted.is_(False))
            .order_by(RequestStatusModel.id.asc())
        )
        return list(self._session.execute(stmt).scalars().all())
