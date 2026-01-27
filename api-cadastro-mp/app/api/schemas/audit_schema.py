# app/api/schemas/audit_schema.py

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class AuditLogRowResponse(BaseModel):
    id: int
    entity_name: str
    entity_id: int | None
    action_name: str
    details: str | None
    occurred_at: datetime
    user_name: str | None  # ✅ trocado


class AuditLogsListResponse(BaseModel):
    items: list[AuditLogRowResponse]
    total: int
    limit: int
    offset: int


class AuditCountByDayRow(BaseModel):
    day: datetime
    count: int


class AuditCountByEntityActionRow(BaseModel):
    entity_name: str
    action_name: str
    count: int


class AuditTopUserRow(BaseModel):
    user_name: str | None  # ✅ trocado (pode ser None p/ logs antigos sem user)
    count: int


class AuditSummaryResponse(BaseModel):
    by_day: list[AuditCountByDayRow]
    by_entity_action: list[AuditCountByEntityActionRow]
    top_users: list[AuditTopUserRow]
