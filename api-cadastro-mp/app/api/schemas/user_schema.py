# app/api/schemas/user_schema.py
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class CreateUserRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class UpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=100)
    email: EmailStr | None = None
    role_id: int | None = Field(default=None, gt=0)
    password: str | None = Field(default=None, min_length=8, max_length=200)
    current_password: str = Field(min_length=6, max_length=200)

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role_id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None  # opcional: logout total da sessão se enviar refresh


    # -------------------------
# ADMIN
# -------------------------

class AdminUpdateUserRequest(BaseModel):
    role_id: int | None = None
    is_deleted: bool | None = None


class AdminUserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role_id: int
    is_deleted: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    last_login: datetime | None = None


class AdminUsersListResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int
    limit: int
    offset: int