# app/service/user_service.py

from datetime import datetime

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.infrastructure.security.password_hasher import PasswordHasher
from app.infrastructure.database.models.user_model import UserModel
from app.repositories.user_repository import UserRepository
from app.services.central_subject_binding import (
    OUTCOME_CONFLICT,
    OUTCOME_NOT_FOUND,
    OUTCOME_UNCHANGED,
    OUTCOME_UPDATED,
    decide_central_subject_bind,
)

ROLE_USER_ID = 3


class UserService:
    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    def create_user(self, *, full_name: str, email: str, password: str) -> UserModel:
        existing = self._user_repository.get_by_email(email.strip().lower())
        if existing is not None:
            raise ConflictError("Email já cadastrado.")

        password_hash, password_salt, algo, iterations = PasswordHasher.hash_password(password)

        now = datetime.utcnow()
        model = UserModel(
            full_name=full_name.strip(),
            email=email.strip().lower(),
            role_id=ROLE_USER_ID,
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
        current_password: str,
        full_name: str | None = None,
        email: str | None = None,
        role_id: int | None = None,
        password: str | None = None,
    ) -> UserModel:
        """
        Regra: qualquer alteração do próprio usuário exige validação da senha atual.
        """
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")

        ok = PasswordHasher.verify_password(
            current_password,
            password_hash=user.password_hash,
            password_salt=user.password_salt,
            iterations=user.password_iterations,
            algo=user.password_algo,
        )
        if not ok:
            raise UnauthorizedError("Senha atual inválida.")

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

    # -------------------------
    # ADMIN
    # -------------------------

    def admin_list_users(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        include_deleted: bool = True,
    ) -> tuple[list[UserModel], int]:
        total = self._user_repository.count_all(include_deleted=include_deleted)
        items = self._user_repository.list_all(limit=limit, offset=offset, include_deleted=include_deleted)
        return items, total

    def admin_update_user(
        self,
        *,
        user_id: int,
        role_id: int | None = None,
        is_deleted: bool | None = None,
    ) -> UserModel:
        user = self._user_repository.get_by_id_any(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")

        if role_id is not None:
            user.role_id = role_id

        if is_deleted is not None:
            user.is_deleted = is_deleted

        user.updated_at = datetime.utcnow()
        return user

    def sync_central_subjects_from_directory(
        self,
        directory_by_email: dict[str, str],
    ) -> dict:
        now = datetime.utcnow()
        updated = 0
        unchanged = 0
        not_found = 0
        conflicts: list[dict] = []

        for user in self._user_repository.list_all_unpaged():
            email = (user.email or "").strip().lower()
            incoming = directory_by_email.get(email)
            occupied = None
            if incoming:
                other = self._user_repository.get_by_central_subject(incoming)
                if other is not None:
                    occupied = int(other.id)

            decision = decide_central_subject_bind(
                user_id=int(user.id),
                current_subject=user.central_subject,
                directory_subject=incoming,
                occupied_by_other_user_id=occupied,
            )

            if decision.outcome == OUTCOME_UPDATED and decision.subject:
                user.central_subject = decision.subject
                user.updated_at = now
                updated += 1
                continue

            if decision.outcome == OUTCOME_UNCHANGED:
                unchanged += 1
                continue

            if decision.outcome == OUTCOME_NOT_FOUND:
                not_found += 1
                continue

            if decision.outcome == OUTCOME_CONFLICT:
                conflicts.append(
                    {
                        "user_id": int(user.id),
                        "email": email,
                        "reason": decision.reason or "Conflito ao vincular ID da Minha DELPI.",
                    }
                )

        return {
            "updated": updated,
            "unchanged": unchanged,
            "not_found": not_found,
            "conflicts": conflicts,
            "directory_count": len(directory_by_email),
        }

    # -------------------------
    # SSO Minha DELPI / Keycloak
    # -------------------------
    def get_or_create_from_sso(
        self,
        *,
        full_name: str,
        email: str,
        central_subject: str,
        role_id: int = ROLE_USER_ID,
    ) -> UserModel:
        subject = str(central_subject or "").strip()
        if not subject:
            raise UnauthorizedError("Token SSO sem identificador central.")

        normalized_email = email.strip().lower()
        now = datetime.utcnow()
        name = (full_name or "").strip() or normalized_email

        by_subject = self._user_repository.get_by_central_subject(subject)
        if by_subject is not None:
            return self._sync_sso_profile(
                user=by_subject,
                full_name=name,
                email=normalized_email,
                central_subject=subject,
                now=now,
            )

        by_email = self._user_repository.get_by_email(normalized_email)
        if by_email is not None:
            existing_subject = (by_email.central_subject or "").strip()
            if existing_subject and existing_subject != subject:
                raise ConflictError(
                    "Este e-mail já está vinculado a outro usuário da Minha DELPI.")
            return self._sync_sso_profile(
                user=by_email,
                full_name=name,
                email=normalized_email,
                central_subject=subject,
                now=now,
            )

        random_password = f"sso:{normalized_email}:{now.timestamp()}"
        password_hash, password_salt, algo, iterations = PasswordHasher.hash_password(
            random_password)

        model = UserModel(
            full_name=name,
            email=normalized_email,
            central_subject=subject,
            role_id=role_id,
            password_algo=algo,
            password_iterations=iterations,
            password_hash=password_hash,
            password_salt=password_salt,
            created_at=now,
            updated_at=None,
            last_login=now,
            is_deleted=False,
        )
        return self._user_repository.add(model)

    def _sync_sso_profile(
        self,
        *,
        user: UserModel,
        full_name: str,
        email: str,
        central_subject: str,
        now: datetime,
    ) -> UserModel:
        changed = False

        if full_name and user.full_name != full_name:
            user.full_name = full_name
            changed = True

        if email != user.email:
            other = self._user_repository.get_by_email(email)
            if other is not None and int(other.id) != int(user.id):
                raise ConflictError(
                    "Este e-mail já está cadastrado em outro usuário.")
            user.email = email
            changed = True

        if (user.central_subject or "").strip() != central_subject:
            user.central_subject = central_subject
            changed = True

        user.last_login = now
        if changed:
            user.updated_at = now
        return user
