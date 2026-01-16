# app/infrastructure/database/models/conversation_participant_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class ConversationParticipantModel(BaseModel):
    __tablename__ = "tbConversationParticipants"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    conversation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbConversations.id"), nullable=False
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbUsers.id"), nullable=False
    )

    last_read_message_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbMessages.id"), nullable=True
    )

    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
