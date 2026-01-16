# app/services/audit_service.py

from datetime import datetime

from app.infrastructure.database.models.audit_log_model import AuditLogModel
from app.repositories.audit_log_repository import AuditLogRepository


class AuditService:
    def __init__(self, repo: AuditLogRepository) -> None:
        self._repo = repo

    def log(
        self,
        *,
        entity_name: str,
        action_name: str,
        user_id: int | None,
        entity_id: int | None = None,
        details: str | None = None,
    ) -> None:
        model = AuditLogModel(
            entity_name=entity_name,
            entity_id=entity_id,
            action_name=action_name,
            details=details,
            user_id=user_id,
        )
        self._repo.add(model)
