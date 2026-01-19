from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base_model import BaseModel


class FieldTypeModel(BaseModel):
    __tablename__ = "tbFieldType"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # ajuste o nome da coluna conforme o banco (ex.: code, description...)
    type_name: Mapped[str] = mapped_column(String(50), nullable=False)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
