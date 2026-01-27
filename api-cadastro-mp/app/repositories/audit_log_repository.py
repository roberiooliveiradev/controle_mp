# app/repositories/audit_log_repository.py

from __future__ import annotations

from datetime import datetime
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.audit_log_model import AuditLogModel
from app.infrastructure.database.models.user_model import UserModel


class AuditLogRepository(BaseRepository[AuditLogModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: AuditLogModel) -> AuditLogModel:
        self._session.add(model)
        self._session.flush()
        return model

    def list_logs(
        self,
        *,
        limit: int,
        offset: int,
        entity_name: str | None = None,
        action_name: str | None = None,
        user_name: str | None = None,   # ✅ NOVO
        user_id: int | None = None,     # (opcional compat)
        entity_id: int | None = None,
        q: str | None = None,
        occurred_from=None,
        occurred_to=None,
    ):
        query = (
            self._session.query(AuditLogModel, UserModel)
            .outerjoin(UserModel, UserModel.id == AuditLogModel.user_id)
        )

        if entity_name:
            query = query.filter(
                AuditLogModel.entity_name.ilike(f"%{entity_name}%"))

        if action_name:
            query = query.filter(
                AuditLogModel.action_name.ilike(f"%{action_name}%"))

        # ✅ filtro por nome (match parcial)
        if user_name:
            query = query.filter(UserModel.full_name.ilike(f"%{user_name}%"))

        # (opcional compat)
        if user_id is not None:
            query = query.filter(AuditLogModel.user_id == user_id)

        if entity_id is not None:
            query = query.filter(AuditLogModel.entity_id == entity_id)

        if occurred_from is not None:
            query = query.filter(AuditLogModel.occurred_at >= occurred_from)

        if occurred_to is not None:
            query = query.filter(AuditLogModel.occurred_at <= occurred_to)

        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    AuditLogModel.details.ilike(like),
                    AuditLogModel.entity_name.ilike(like),
                    AuditLogModel.action_name.ilike(like),
                    # ✅ busca livre também no nome
                    UserModel.full_name.ilike(like),
                )
            )

        total = query.with_entities(func.count()).scalar() or 0

        rows = (
            query.order_by(AuditLogModel.occurred_at.desc(),
                           AuditLogModel.id.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        items = []
        for log, user in rows:
            items.append(
                {
                    "id": int(log.id),
                    "entity_name": log.entity_name,
                    "entity_id": (int(log.entity_id) if log.entity_id is not None else None),
                    "action_name": log.action_name,
                    "details": log.details,
                    "occurred_at": log.occurred_at,
                    "user_name": (user.full_name if user else None),
                }
            )

        return items, int(total)

    def report_counts_by_day(
        self,
        *,
        occurred_from: datetime | None,
        occurred_to: datetime | None,
        entity_name: str | None = None,
        action_name: str | None = None,
        user_id: int | None = None,
    ) -> list[dict]:
        q = self._session.query(
            func.date_trunc("day", AuditLogModel.occurred_at).label("day"),
            func.count(AuditLogModel.id).label("count"),
        )

        if occurred_from is not None:
            q = q.filter(AuditLogModel.occurred_at >= occurred_from)
        if occurred_to is not None:
            q = q.filter(AuditLogModel.occurred_at <= occurred_to)
        if entity_name:
            q = q.filter(AuditLogModel.entity_name == entity_name)
        if action_name:
            q = q.filter(AuditLogModel.action_name == action_name)
        if user_id is not None:
            q = q.filter(AuditLogModel.user_id == user_id)

        rows = (
            q.group_by("day")
            .order_by(func.date_trunc("day", AuditLogModel.occurred_at).asc())
            .all()
        )

        return [{"day": r.day, "count": int(r.count)} for r in rows]

    def report_counts_by_entity_action(
        self,
        *,
        occurred_from: datetime | None,
        occurred_to: datetime | None,
    ) -> list[dict]:
        q = self._session.query(
            AuditLogModel.entity_name.label("entity_name"),
            AuditLogModel.action_name.label("action_name"),
            func.count(AuditLogModel.id).label("count"),
        )

        if occurred_from is not None:
            q = q.filter(AuditLogModel.occurred_at >= occurred_from)
        if occurred_to is not None:
            q = q.filter(AuditLogModel.occurred_at <= occurred_to)

        rows = (
            q.group_by(AuditLogModel.entity_name, AuditLogModel.action_name)
            .order_by(func.count(AuditLogModel.id).desc())
            .all()
        )

        return [
            {"entity_name": r.entity_name,
                "action_name": r.action_name, "count": int(r.count)}
            for r in rows
        ]

    def report_top_users(
        self,
        *,
        occurred_from: datetime | None,
        occurred_to: datetime | None,
        limit: int = 10,
    ) -> list[dict]:
        q = (
            self._session.query(
                UserModel.full_name.label("user_name"),
                func.count(AuditLogModel.id).label("count"),
            )
            .outerjoin(UserModel, UserModel.id == AuditLogModel.user_id)
            .filter(AuditLogModel.user_id.isnot(None))
        )

        if occurred_from is not None:
            q = q.filter(AuditLogModel.occurred_at >= occurred_from)
        if occurred_to is not None:
            q = q.filter(AuditLogModel.occurred_at <= occurred_to)

        rows = (
            q.group_by(UserModel.full_name)
            .order_by(func.count(AuditLogModel.id).desc())
            .limit(limit)
            .all()
        )

        return [{"user_name": r.user_name, "count": int(r.count)} for r in rows]
