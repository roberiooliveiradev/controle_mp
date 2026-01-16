# app/repositories/conversation_participant_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.conversation_participant_model import ConversationParticipantModel


class ConversationParticipantRepository(BaseRepository[ConversationParticipantModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def get(self, *, conversation_id: int, user_id: int):
        stmt = (
            select(ConversationParticipantModel)
            .where(
                ConversationParticipantModel.conversation_id == conversation_id,
                ConversationParticipantModel.user_id == user_id,
                ConversationParticipantModel.is_deleted.is_(False),
            )
        )
        return self._session.execute(stmt).scalars().first()

    def ensure(self, *, conversation_id: int, user_id: int) -> ConversationParticipantModel:
        existing = self.get(conversation_id=conversation_id, user_id=user_id)
        if existing:
            return existing

        model = ConversationParticipantModel(conversation_id=conversation_id, user_id=user_id)
        self._session.add(model)
        self._session.flush()
        return model

    def set_last_read(self, *, conversation_id: int, user_id: int, last_read_message_id: int) -> None:
        stmt = (
            update(ConversationParticipantModel)
            .where(
                ConversationParticipantModel.conversation_id == conversation_id,
                ConversationParticipantModel.user_id == user_id,
                ConversationParticipantModel.is_deleted.is_(False),
            )
            .values(last_read_message_id=last_read_message_id, last_read_at=func.now(), updated_at=func.now())
        )
        self._session.execute(stmt)
