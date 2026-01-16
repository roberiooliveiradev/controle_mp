# app/service/user_service.py

from datetime import datetime

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.infrastructure.security.password_hasher import PasswordHasher
from app.infrastructure.database.models.user_model import UserModel
from app.repositories.user_repository import UserRepository

class UserService:
    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    def create_user(self, *, full_name: str, email: str, role_id: int, password: str) -> UserModel:
        existing = self._user_repository.get_by_email(email.strip().lower())
        if existing is not None:
            raise ConflictError("Email já cadastrado.")

        password_hash, password_salt, algo, iterations = PasswordHasher.hash_password(password)

        now = datetime.utcnow()
        model = UserModel(
            full_name=full_name.strip(),
            email=email.strip(),
            role_id=role_id,
            password_algo=algo,
            password_iterations=iterations,
            password_hash=password_hash,
            password_salt=password_salt,
            created_at=now,
            updated_at=None,
            last_login=None,
            is_deleted=False,
        )
        return self._user_repository.add(model)

    def update_user(
        self,
        *,
        user_id: int,
        full_name: str | None = None,
        email: str | None = None,
        role_id: int | None = None,
        password: str | None = None,
    ) -> UserModel:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")

        if email and email.strip().lower() != user.email:
            existing = self._user_repository.get_by_email(email.strip().lower())
            if existing is not None:
                raise ConflictError("Email já cadastrado.")

        if full_name is not None:
            user.full_name = full_name.strip()
        if email is not None:
            user.email = email.strip().lower()
        if role_id is not None:
            user.role_id = role_id
        if password is not None:
            password_hash, password_salt, algo, iterations = PasswordHasher.hash_password(password)
            user.password_hash = password_hash
            user.password_salt = password_salt
            user.password_algo = algo
            user.password_iterations = iterations

        user.updated_at = datetime.utcnow()
        return user

    def delete_user(self, *, user_id: int) -> None:
        ok = self._user_repository.soft_delete(user_id)
        if not ok:
            raise NotFoundError("Usuário não encontrado.")

    def list_users(self, *, limit: int = 50, offset: int = 0) -> list[UserModel]:
        return self._user_repository.list_active(limit=limit, offset=offset)

    def authenticate(self, *, email: str, password: str) -> UserModel:
        user = self._user_repository.get_by_email(email.strip().lower())
        if user is None:
            raise UnauthorizedError("Credenciais inválidas.")

        ok = PasswordHasher.verify_password(
            password,
            password_hash=user.password_hash,
            password_salt=user.password_salt,
            iterations=user.password_iterations,
            algo=user.password_algo,
        )
        if not ok:
            raise UnauthorizedError("Credenciais inválidas.")

        user.last_login = datetime.utcnow()
        return user
