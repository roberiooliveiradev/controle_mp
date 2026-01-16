# # app/repositories/message_type_repository.py

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.message_type_model import MessageTypeModel


class MessageTypeRepository(BaseRepository[MessageTypeModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def get_id_by_code(self, code: str) -> int | None:
        stmt = select(MessageTypeModel.id).where(
            MessageTypeModel.code == code,
            MessageTypeModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalar_one_or_none()
