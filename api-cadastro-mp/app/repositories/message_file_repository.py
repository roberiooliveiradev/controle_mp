# app/repositories/message_file_repository.py

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.message_file_model import MessageFileModel


class MessageFileRepository(BaseRepository[MessageFileModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add_many(self, files: list[MessageFileModel]) -> None:
        self._session.add_all(files)
        self._session.flush()

    def list_by_message_ids(self, message_ids: list[int]) -> dict[int, list[MessageFileModel]]:
        if not message_ids:
            return {}

        stmt = (
            select(MessageFileModel)
            .where(MessageFileModel.message_id.in_(message_ids), MessageFileModel.is_deleted.is_(False))
            .order_by(MessageFileModel.created_at.asc())
        )
        rows = list(self._session.execute(stmt).scalars().all())

        grouped: dict[int, list[MessageFileModel]] = {}
        for f in rows:
            grouped.setdefault(f.message_id, []).append(f)
        return grouped
