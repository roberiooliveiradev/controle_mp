# app/infrastructure/database/models/refresh_token_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, CHAR
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class RefreshTokenModel(BaseModel):
    __tablename__ = "tbRefreshTokens"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tbUsers.id"), nullable=False)

    token_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, unique=True)
    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    issued_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    revoked_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    replaced_by_jti: Mapped[str] = mapped_column(String(64), nullable=True)
    reason: Mapped[str] = mapped_column(String(100), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
