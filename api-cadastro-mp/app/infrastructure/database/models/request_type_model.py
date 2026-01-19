from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class RequestTypeModel(BaseModel):
    __tablename__ = "tbRequestType"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    type_name: Mapped[str] = mapped_column(String(50), nullable=False)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
