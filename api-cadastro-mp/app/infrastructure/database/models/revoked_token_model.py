from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class RevokedTokenModel(BaseModel):
    __tablename__ = "tbRevokedTokens"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tbUsers.id"), nullable=False)

    revoked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # ✅ sem Optional/Union no Mapped (mesmo sendo nullable)
    reason: Mapped[str] = mapped_column(String(100), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
