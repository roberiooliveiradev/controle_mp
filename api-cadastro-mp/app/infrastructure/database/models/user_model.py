# app/infrastructure/database/models/user_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class UserModel(BaseModel):
    __tablename__ = "tbUsers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)

    password_algo: Mapped[str] = mapped_column(String(50), nullable=False)
    password_iterations: Mapped[int] = mapped_column(nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    password_salt: Mapped[str] = mapped_column(Text, nullable=False)

    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbRoles.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    last_login: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
