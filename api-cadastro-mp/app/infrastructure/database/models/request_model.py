# app/infrastructure/database/models/request_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class RequestModel(BaseModel):
    __tablename__ = "tbRequest"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    message_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbMessages.id"), nullable=False, unique=True
    )

    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbUsers.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
