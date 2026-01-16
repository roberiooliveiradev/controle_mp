# app/infrastructure/database/models/message_file_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class MessageFileModel(BaseModel):
    __tablename__ = "tbMessageFiles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    message_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbMessages.id"), nullable=False
    )

    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)

    content_type: Mapped[str] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
