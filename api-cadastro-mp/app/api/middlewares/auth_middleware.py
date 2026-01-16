from functools import wraps
from typing import Any, Callable, TypeVar

from flask import request, g

from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.infrastructure.database.session import db_session
from app.infrastructure.security.jwt_provider import JwtProvider
from app.repositories.revoked_token_repository import RevokedTokenRepository

F = TypeVar("F", bound=Callable[..., Any])


def _get_bearer_token() -> str:
    auth = request.headers.get("Authorization", "")
    parts = auth.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    raise UnauthorizedError("Token ausente.")


def require_auth(fn: F) -> F:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _get_bearer_token()
        jwt_provider = JwtProvider()

        with db_session() as session:
            revoked_repo = RevokedTokenRepository(session)
            claims = jwt_provider.decode(token)

            if claims.get("typ") != "access":
                raise UnauthorizedError("Token inválido.")

            jti = claims.get("jti")
            if not jti:
                raise UnauthorizedError("Token inválido.")

            if revoked_repo.is_revoked(str(jti)):
                raise UnauthorizedError("Token revogado.")

            g.auth = claims

        return fn(*args, **kwargs)

    return wrapper  # type: ignore[return-value]


def require_roles(*allowed_role_ids: int):
    def decorator(fn: F) -> F:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not hasattr(g, "auth"):
                raise UnauthorizedError("Token ausente.")

            role_id = g.auth.get("role_id")
            if role_id is None or int(role_id) not in set(int(x) for x in allowed_role_ids):
                raise ForbiddenError("Acesso negado.")

            return fn(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator
