# app/api/schemas/request_schema.py

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_serializer
from app.api.schemas._datetime_serializer import serialize_dt

class UserMiniResponse(BaseModel):
    id: int
    full_name: str
# -------- Types / Status (mini) --------
class RequestTypeMiniResponse(BaseModel):
    id: int
    type_name: str


class RequestStatusMiniResponse(BaseModel):
    id: int
    status_name: str


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

    @field_serializer("created_at", "updated_at")
    def serialize_dates(self, value: datetime | None):
        return serialize_dt(value)


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

    # ✅ novos campos (nome + id)
    request_type: Optional[RequestTypeMiniResponse] = None
    request_status: Optional[RequestStatusMiniResponse] = None

    product_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    fields: List[RequestItemFieldResponse] = []

    @field_serializer("created_at", "updated_at")
    def serialize_dates(self, value: datetime | None):
        return serialize_dt(value)


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

    @field_serializer("created_at", "updated_at")
    def serialize_dates(self, value: datetime | None):
        return serialize_dt(value)

# -------- Listagem (tela) --------
class RequestItemListRowResponse(BaseModel):
    """Linha 'flattened' para a tela de listagem de solicitações (RequestItems)."""

    request_id: int

    request_created_by: int
    request_created_by_user: UserMiniResponse

    request_created_at: datetime
    request_updated_at: Optional[datetime] = None

    message_id: int
    conversation_id: int

    item_id: int
    request_type_id: int
    request_status_id: int
    request_type: Optional[RequestTypeMiniResponse] = None
    request_status: Optional[RequestStatusMiniResponse] = None

    product_id: Optional[int] = None
    item_created_at: datetime
    item_updated_at: Optional[datetime] = None
    fields_count: int = 0

    @field_serializer(
        "request_created_at",
        "request_updated_at",
        "item_created_at",
        "item_updated_at",
    )
    def serialize_dates(self, value: datetime | None):
        return serialize_dt(value)


class RequestItemListResponse(BaseModel):
    items: List[RequestItemListRowResponse]
    total: int
    limit: int
    offset: int


