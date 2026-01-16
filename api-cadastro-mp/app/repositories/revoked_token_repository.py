# app/repositories/revoked_token_repository.py

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.revoked_token_model import RevokedTokenModel


class RevokedTokenRepository(BaseRepository[RevokedTokenModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: RevokedTokenModel) -> RevokedTokenModel:
        self._session.add(model)
        self._session.flush()
        return model

    def is_revoked(self, jti: str) -> bool:
        stmt = select(RevokedTokenModel.id).where(
            RevokedTokenModel.jti == jti,
            RevokedTokenModel.is_deleted.is_(False),
        )

        result = self._session.execute(stmt).scalars().first()
        return result is not None


    def cleanup_expired(self, *, now: datetime) -> int:
        stmt = (
            update(RevokedTokenModel)
            .where(
                RevokedTokenModel.expires_at < now,
                RevokedTokenModel.is_deleted.is_(False),
            )
            .values(is_deleted=True)
        )
        result = self._session.execute(stmt)
        return int(result.rowcount or 0)
