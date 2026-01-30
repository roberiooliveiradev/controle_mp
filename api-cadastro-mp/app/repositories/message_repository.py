# app/repositories/message_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session, aliased

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.message_model import MessageModel
from app.infrastructure.database.models.user_model import UserModel


class MessageRepository(BaseRepository[MessageModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: MessageModel) -> MessageModel:
        self._session.add(model)
        self._session.flush()
        return model

    def soft_delete(self, *, message_id: int) -> bool:
        stmt = (
            update(MessageModel)
            .where(MessageModel.id == message_id, MessageModel.is_deleted.is_(False))
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def get_row(self, *, message_id: int):
        sender = aliased(UserModel)
        stmt = (
            select(MessageModel, sender)
            .join(sender, sender.id == MessageModel.sender_id)
            .where(MessageModel.id == message_id, MessageModel.is_deleted.is_(False))
        )
        return self._session.execute(stmt).first()  # (msg, sender) | None

    def list_rows_by_conversation(self, *, conversation_id: int):
        sender = aliased(UserModel)
        stmt = (
            select(MessageModel, sender)
            .join(sender, sender.id == MessageModel.sender_id)
            .where(MessageModel.conversation_id == conversation_id, MessageModel.is_deleted.is_(False))
            .order_by(MessageModel.id.asc())
        )
        return list(self._session.execute(stmt).all())

    def max_message_id_in_conversation(self, *, conversation_id: int, message_ids: list[int]) -> int | None:
        stmt = (
            select(func.max(MessageModel.id))
            .where(
                MessageModel.conversation_id == conversation_id,
                MessageModel.id.in_(message_ids),
                MessageModel.is_deleted.is_(False),
            )
        )
        return self._session.execute(stmt).scalar_one_or_none()
