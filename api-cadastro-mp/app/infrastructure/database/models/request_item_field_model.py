# app/infrastructure/database/models/request_item_field_model.py

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class RequestItemFieldModel(BaseModel):
    __tablename__ = "tbRequestItemFields"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    request_items_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbRequestItem.id"), nullable=False
    )

    field_type_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tbFieldType.id"), nullable=False
    )

    field_tag: Mapped[str] = mapped_column(String(255), nullable=False)
    field_value: Mapped[str] = mapped_column(Text, nullable=True)
    field_flag: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
