# app/repositories/request_type_repository.py

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.request_type_model import RequestTypeModel


class RequestTypeRepository(BaseRepository[RequestTypeModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def get_map_by_ids(self, ids: list[int]) -> dict[int, RequestTypeModel]:
        ids = [int(x) for x in ids if x is not None]
        if not ids:
            return {}

        stmt = select(RequestTypeModel).where(
            RequestTypeModel.id.in_(ids),
            RequestTypeModel.is_deleted.is_(False),
        )
        rows = list(self._session.execute(stmt).scalars().all())
        return {int(r.id): r for r in rows}

    def list_active(self) -> list[RequestTypeModel]:
        stmt = (
            select(RequestTypeModel)
            .where(RequestTypeModel.is_deleted.is_(False))
            .order_by(RequestTypeModel.id.asc())
        )
        return list(self._session.execute(stmt).scalars().all())
