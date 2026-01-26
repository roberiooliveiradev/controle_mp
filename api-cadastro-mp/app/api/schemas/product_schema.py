# app/api/schemas/product_schema.py

from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class ProductFieldResponse(BaseModel):
    id: int
    product_id: int
    field_type_id: int
    field_tag: str
    field_value: Optional[str] = None
    field_flag: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class ProductResponse(BaseModel):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    fields: list[ProductFieldResponse]

class ProductListRowResponse(BaseModel):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # campos “derivados” para tabela (opcional)
    codigo_atual: Optional[str] = None
    descricao: Optional[str] = None
    flags_count: Optional[int] = None

class ProductListResponse(BaseModel):
    items: list[ProductListRowResponse]
    total: int
    limit: int
    offset: int
