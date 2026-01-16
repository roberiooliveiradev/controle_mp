# app/api/schemas/message_schema.py

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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


class RequestMiniResponse(BaseModel):
    id: int
    message_id: int
    created_by: int
    created_at: datetime


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

    # leitura do usuário autenticado
    is_read: bool


class CreateMessageFileInput(BaseModel):
    original_name: str = Field(min_length=1, max_length=255)
    stored_name: str = Field(min_length=1, max_length=255)
    content_type: Optional[str] = Field(default=None, max_length=100)
    size_bytes: Optional[int] = None
    sha256: Optional[str] = Field(default=None, max_length=64)


class CreateMessageRequestInput(BaseModel):
    # texto opcional
    body: Optional[str] = None

    # tipo (FK)
    message_type_id: int

    # anexos opcionais
    files: Optional[List[CreateMessageFileInput]] = None

    # cria um Request vinculado à message (opcional)
    create_request: bool = False


class MarkReadRequest(BaseModel):
    # ids de mensagens da conversa marcadas como lidas
    message_ids: List[int] = Field(min_length=1)
