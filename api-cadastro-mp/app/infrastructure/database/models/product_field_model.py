# app/infrastructure/database/models/product_field_model.py

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Text, String, func
from app.infrastructure.database.base_model import BaseModel

class ProductFieldModel(BaseModel):
    __tablename__ = "tbProductFields"

    id = Column(BigInteger, primary_key=True)
    product_id = Column(BigInteger, ForeignKey('tbProduct.id'), nullable=False)

    field_type_id = Column(BigInteger, ForeignKey('tbFieldType.id'), nullable=False)
    field_tag = Column(String(255), nullable=False)
    field_value = Column(Text, nullable=True)
    field_flag = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, nullable=False, server_default="false")
