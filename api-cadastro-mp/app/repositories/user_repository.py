# app/repositories/user_repository.py

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.user_model import UserModel


class UserRepository(BaseRepository[UserModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def get_by_email(self, email: str) -> UserModel | None:
        stmt = select(UserModel).where(UserModel.email == email, UserModel.is_deleted.is_(False))
        return self._session.execute(stmt).scalar_one_or_none()

    def get_by_id(self, user_id: int) -> UserModel | None:
        stmt = select(UserModel).where(UserModel.id == user_id, UserModel.is_deleted.is_(False))
        return self._session.execute(stmt).scalar_one_or_none()

    def list_active(self, limit: int = 50, offset: int = 0) -> list[UserModel]:
        stmt = (
            select(UserModel)
            .where(UserModel.is_deleted.is_(False))
            .order_by(UserModel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self._session.execute(stmt).scalars().all())

    def add(self, model: UserModel) -> UserModel:
        self._session.add(model)
        self._session.flush()
        return model

    def soft_delete(self, user_id: int) -> bool:
        stmt = (
            update(UserModel)
            .where(UserModel.id == user_id, UserModel.is_deleted.is_(False))
            .values(is_deleted=True)
        )
        result = self._session.execute(stmt)
        return (result.rowcount or 0) > 0
