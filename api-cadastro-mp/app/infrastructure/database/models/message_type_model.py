from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class MessageTypeModel(BaseModel):
    __tablename__ = "tbMessageTypes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # TEXT | REQUEST | SYSTEM
    code: Mapped[str] = mapped_column(String(30), nullable=False)

    description: Mapped[str] = mapped_column(String(255), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
