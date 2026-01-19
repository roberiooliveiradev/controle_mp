# app/api/schemas/message_schema.py

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_serializer

from app.api.schemas._datetime_serializer import serialize_dt
from app.api.schemas.request_schema import CreateRequestItemInput


class UserMiniResponse(BaseModel):
    id: int
    full_name: str
    email: str


class MessageFileResponse(BaseModel):
    id: int
    original_name: str
    stored_name: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    sha256: Optional[str] = None
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime):
        return serialize_dt(value)


class RequestMiniResponse(BaseModel):
    id: int
    message_id: int
    created_by: int
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime):
        return serialize_dt(value)


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    body: Optional[str] = None
    message_type_id: int

    created_at: datetime
    updated_at: Optional[datetime] = None

    sender: UserMiniResponse
    files: List[MessageFileResponse] = []
    request: Optional[RequestMiniResponse] = None

    is_read: bool

    @field_serializer("created_at", "updated_at")
    def serialize_dates(self, value: datetime | None):
        return serialize_dt(value)


class CreateMessageFileInput(BaseModel):
    original_name: str = Field(min_length=1, max_length=255)
    stored_name: str = Field(min_length=1, max_length=255)
    content_type: Optional[str] = Field(default=None, max_length=100)
    size_bytes: Optional[int] = None
    sha256: Optional[str] = Field(default=None, max_length=64)


class CreateMessageRequestInput(BaseModel):
    body: Optional[str] = None
    message_type_id: int
    files: Optional[List[CreateMessageFileInput]] = None

    create_request: bool = False

    # ✅ carrinho (itens)
    request_items: Optional[List[CreateRequestItemInput]] = None


class MarkReadRequest(BaseModel):
    message_ids: List[int] = Field(min_length=1)
