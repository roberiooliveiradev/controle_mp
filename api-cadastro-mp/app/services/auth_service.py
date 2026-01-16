# app/services/auth_service.py

from datetime import datetime, timezone

from app.core.exceptions import UnauthorizedError
from app.infrastructure.database.models.revoked_token_model import RevokedTokenModel
from app.infrastructure.security.jwt_provider import JwtProvider
from app.repositories.revoked_token_repository import RevokedTokenRepository


class AuthService:
    def __init__(self, *, jwt_provider: JwtProvider, revoked_repo: RevokedTokenRepository) -> None:
        self._jwt = jwt_provider
        self._revoked_repo = revoked_repo

    def revoke_access_token(self, *, token: str, reason: str | None = None) -> None:
        claims = self._jwt.decode(token)  # se inválido/expirado => UnauthorizedError
        jti = claims.get("jti")
        sub = claims.get("sub")
        exp = claims.get("exp")

        if not jti or not sub or not exp:
            raise UnauthorizedError("Token inválido.")

        # exp vem como unix timestamp (segundos)
        expires_at = datetime.fromtimestamp(int(exp), tz=timezone.utc).replace(tzinfo=None)

        # Evita duplicar revogação
        if self._revoked_repo.is_revoked(jti):
            return

        model = RevokedTokenModel(
            jti=str(jti),
            user_id=int(sub),
            revoked_at=datetime.utcnow(),
            expires_at=expires_at,
            reason=reason,
            is_deleted=False,
        )
        self._revoked_repo.add(model)

    def is_token_revoked(self, *, jti: str) -> bool:
        return self._revoked_repo.is_revoked(jti=jti)
