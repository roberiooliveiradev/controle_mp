# app/services/audit_report_service.py

from __future__ import annotations

from datetime import datetime

from app.repositories.audit_log_repository import AuditLogRepository


class AuditReportService:
    def __init__(self, repo: AuditLogRepository) -> None:
        self._repo = repo

    def list_logs(
        self,
        *,
        limit: int,
        offset: int,
        entity_name: str | None = None,
        action_name: str | None = None,
        user_id: int | None = None,
        entity_id: int | None = None,
        q: str | None = None,
        occurred_from: datetime | None = None,
        occurred_to: datetime | None = None,
    ):
        return self._repo.list_logs(
            limit=limit,
            offset=offset,
            entity_name=entity_name,
            action_name=action_name,
            user_id=user_id,
            entity_id=entity_id,
            q=q,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )

    def summary(
        self,
        *,
        occurred_from: datetime | None,
        occurred_to: datetime | None,
        entity_name: str | None = None,
        action_name: str | None = None,
        user_id: int | None = None,
        top_users_limit: int = 10,
    ) -> dict:
        by_day = self._repo.report_counts_by_day(
            occurred_from=occurred_from,
            occurred_to=occurred_to,
            entity_name=entity_name,
            action_name=action_name,
            user_id=user_id,
        )

        by_entity_action = self._repo.report_counts_by_entity_action(
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )

        top_users = self._repo.report_top_users(
            occurred_from=occurred_from,
            occurred_to=occurred_to,
            limit=top_users_limit,
        )

        return {
            "by_day": by_day,
            "by_entity_action": by_entity_action,
            "top_users": top_users,
        }
