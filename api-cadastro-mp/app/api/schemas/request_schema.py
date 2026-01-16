# app/api/schemas/request_schema.py

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# -------- Fields --------
class CreateRequestItemFieldInput(BaseModel):
    field_type_id: int
    field_tag: str = Field(min_length=1, max_length=255)
    field_value: Optional[str] = None
    field_flag: Optional[str] = None


class UpdateRequestItemFieldInput(BaseModel):
    field_type_id: Optional[int] = None
    field_tag: Optional[str] = Field(default=None, max_length=255)
    field_value: Optional[str] = None
    field_flag: Optional[str] = None


class RequestItemFieldResponse(BaseModel):
    id: int
    request_items_id: int
    field_type_id: int
    field_tag: str
    field_value: Optional[str] = None
    field_flag: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# -------- Items --------
class CreateRequestItemInput(BaseModel):
    request_type_id: int
    request_status_id: int
    product_id: Optional[int] = None
    fields: List[CreateRequestItemFieldInput] = Field(default_factory=list)


class UpdateRequestItemInput(BaseModel):
    request_type_id: Optional[int] = None
    request_status_id: Optional[int] = None
    product_id: Optional[int] = None


class RequestItemResponse(BaseModel):
    id: int
    request_id: int
    request_type_id: int
    request_status_id: int
    product_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    fields: List[RequestItemFieldResponse] = []


# -------- Request --------
class CreateRequestInput(BaseModel):
    message_id: int
    items: List[CreateRequestItemInput] = Field(min_length=1)


class RequestResponse(BaseModel):
    id: int
    message_id: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[RequestItemResponse] = []