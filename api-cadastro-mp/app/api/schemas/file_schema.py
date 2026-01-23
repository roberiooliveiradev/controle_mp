# app/api/schemas/file_schema.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class UploadFileResponse(BaseModel):
    original_name: str = Field(min_length=1, max_length=255)
    stored_name: str = Field(min_length=1, max_length=255)
    content_type: Optional[str] = Field(default=None, max_length=100)
    size_bytes: int
    sha256: str = Field(min_length=64, max_length=64)


class UploadFilesResponse(BaseModel):
    files: list[UploadFileResponse]
