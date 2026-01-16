from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String
from app.infrastructure.database.base_model import BaseModel

class RoleModel(BaseModel):
    __tablename__ = "tbRoles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    permissions: Mapped[str] = mapped_column(String(150),nullable=False)
    