# app/entities/user.py
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class User:
    id: int
    full_name: str
    email: str
    role_id: int
    created_at: datetime
    updated_at: Optional[datetime]
    last_login: Optional[datetime]
    is_deleted: bool
