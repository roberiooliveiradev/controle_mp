# app/repositories/refresh_token_repository.py

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.refresh_token_model import RefreshTokenModel


class RefreshTokenRepository(BaseRepository[RefreshTokenModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: RefreshTokenModel) -> RefreshTokenModel:
        self._session.add(model)
        self._session.flush()
        return model

    def get_active_by_hash(self, token_hash: str) -> RefreshTokenModel | None:
        stmt = select(RefreshTokenModel).where(
            RefreshTokenModel.token_hash == token_hash,
            RefreshTokenModel.is_deleted.is_(False),
            RefreshTokenModel.revoked_at.is_(None),
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def revoke(self, *, token_id: int, reason: str | None = None, replaced_by_jti: str | None = None) -> None:
        stmt = (
            update(RefreshTokenModel)
            .where(RefreshTokenModel.id == token_id, RefreshTokenModel.is_deleted.is_(False))
            .values(revoked_at=datetime.utcnow(), reason=reason, replaced_by_jti=replaced_by_jti)
        )
        self._session.execute(stmt)

    def soft_delete_expired(self, *, now: datetime) -> int:
        stmt = (
            update(RefreshTokenModel)
            .where(RefreshTokenModel.expires_at < now, RefreshTokenModel.is_deleted.is_(False))
            .values(is_deleted=True)
        )
        result = self._session.execute(stmt)
        return int(result.rowcount or 0)
