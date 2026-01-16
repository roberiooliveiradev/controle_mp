# app/infrastructure/database/models/message_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class MessageModel(BaseModel):
    __tablename__ = "tbMessages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    conversation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbConversations.id"), nullable=False
    )

    sender_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbUsers.id"), nullable=False
    )

    # TEXT (pode ser NULL, desde que tenha files ou request)
    body: Mapped[str] = mapped_column(Text, nullable=True)

    # FK -> tbMessageTypes.id
    message_type_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbMessageTypes.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
