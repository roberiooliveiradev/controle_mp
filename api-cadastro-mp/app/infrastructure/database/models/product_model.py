# app/infrastructure/database/models/product_model.py

from sqlalchemy import BigInteger, Boolean, Column, DateTime, func
from app.infrastructure.database.base_model import BaseModel

class ProductModel(BaseModel):
    __tablename__ = "tbProduct"

    id = Column(BigInteger, primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, nullable=False, server_default="false")
