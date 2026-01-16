# app/infrastructure/database/models/conversation_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class ConversationModel(BaseModel):
    __tablename__ = "tbConversations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbUsers.id"), nullable=False
    )

    # no seu DDL, assigned_to pode ser NULL
    assigned_to: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbUsers.id"), nullable=True
    )

    has_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # ✅ sem Optional/Union pra não quebrar seu SQLAlchemy
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
