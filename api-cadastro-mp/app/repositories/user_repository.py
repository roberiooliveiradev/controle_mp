# app/repositories/user_repository.py

from sqlalchemy import func, select, update
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

    # ✅ admin: inclui deletados
    def get_by_id_any(self, user_id: int) -> UserModel | None:
        stmt = select(UserModel).where(UserModel.id == user_id)
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

    # ✅ admin: lista tudo, opcionalmente incluindo deletados
    def list_all(self, *, limit: int = 50, offset: int = 0, include_deleted: bool = True) -> list[UserModel]:
        stmt = select(UserModel)
        if not include_deleted:
            stmt = stmt.where(UserModel.is_deleted.is_(False))

        stmt = stmt.order_by(UserModel.id.desc()).limit(limit).offset(offset)
        return list(self._session.execute(stmt).scalars().all())

    def count_all(self, *, include_deleted: bool = True) -> int:
        stmt = select(func.count(UserModel.id))
        if not include_deleted:
            stmt = stmt.where(UserModel.is_deleted.is_(False))
        return int(self._session.execute(stmt).scalar_one())

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

    # ✅ admin: setar true/false explicitamente
    def set_is_deleted(self, *, user_id: int, is_deleted: bool) -> bool:
        stmt = update(UserModel).where(UserModel.id == user_id).values(is_deleted=is_deleted)
        result = self._session.execute(stmt)
        return (result.rowcount or 0) > 0
