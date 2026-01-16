# app/repositories/audit_log_repository.py

from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.audit_log_model import AuditLogModel


class AuditLogRepository(BaseRepository[AuditLogModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: AuditLogModel) -> AuditLogModel:
        self._session.add(model)
        self._session.flush()
        return model
