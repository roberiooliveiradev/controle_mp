# app/api/schemas/conversation_schema.py
from datetime import datetime
from pydantic import BaseModel, Field


class UserMiniResponse(BaseModel):
    id: int
    full_name: str
    email: str


class ConversationResponse(BaseModel):
    id: int
    title: str
    has_flag: bool
    created_at: datetime
    updated_at: datetime | None

    created_by: UserMiniResponse
    assigned_to: UserMiniResponse | None


class ConversationListItemResponse(ConversationResponse):
    pass


class CreateConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    has_flag: bool = False
    assigned_to_id: int | None = None


class UpdateConversationRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    has_flag: bool | None = None
    assigned_to_id: int | None = None
