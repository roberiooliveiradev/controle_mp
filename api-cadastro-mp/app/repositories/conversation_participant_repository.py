# app/repositories/conversation_participant_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.conversation_participant_model import ConversationParticipantModel
from app.infrastructure.database.models.message_model import MessageModel
from app.infrastructure.database.models.conversation_model import ConversationModel

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

    def get_unread_count_by_conversation(self, *, user_id: int, created_by_id: int | None = None) -> dict[int, int]:
        """
        Retorna um dict:
        {
            conversation_id: unread_count
        }
        """

        stmt = (
            select(
                MessageModel.conversation_id,
                func.count(MessageModel.id).label("unread_count"),
            )
            .join(
                ConversationParticipantModel,
                ConversationParticipantModel.conversation_id == MessageModel.conversation_id,
            )
            .join(
                ConversationModel,
                ConversationModel.id == ConversationParticipantModel.conversation_id,
            )
            .where(
                ConversationParticipantModel.user_id == user_id,
                ConversationParticipantModel.is_deleted.is_(False),

                # mensagens depois da última lida
                MessageModel.id > func.coalesce(
                    ConversationParticipantModel.last_read_message_id, 0
                ),

                # não contar mensagens do próprio usuário
                MessageModel.sender_id != user_id,

                MessageModel.is_deleted.is_(False),
            )
        )

        
        # created_by (Request.owner)
        if created_by_id is not None:
            stmt = stmt.where(ConversationModel.created_by == int(created_by_id))

        stmt  = stmt.group_by(MessageModel.conversation_id)
        
        rows = self._session.execute(stmt).all()

        return {row.conversation_id: row.unread_count for row in rows}