# app/services/refresh_token_service.py

import hashlib
from datetime import datetime, timezone

from app.core.exceptions import UnauthorizedError
from app.infrastructure.database.models.refresh_token_model import RefreshTokenModel
from app.infrastructure.security.jwt_provider import JwtProvider
from app.repositories.refresh_token_repository import RefreshTokenRepository


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class RefreshTokenService:
    def __init__(self, *, jwt_provider: JwtProvider, repo: RefreshTokenRepository) -> None:
        self._jwt = jwt_provider
        self._repo = repo

    def store_refresh_token(self, *, user_id: int, refresh_token: str) -> RefreshTokenModel:
        claims = self._jwt.decode(refresh_token)
        if claims.get("typ") != "refresh":
            raise UnauthorizedError("Token inválido.")

        exp = int(claims["exp"])
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None)

        model = RefreshTokenModel(
            user_id=user_id,
            token_hash=_sha256(refresh_token),
            jti=str(claims["jti"]),
            issued_at=datetime.utcnow(),
            expires_at=expires_at,
            revoked_at=None,
            replaced_by_jti=None,
            reason=None,
            is_deleted=False,
        )
        return self._repo.add(model)

    def rotate(self, *, refresh_token: str) -> tuple[int, str]:
        # retorna (user_id, new_refresh_token)
        claims = self._jwt.decode(refresh_token)
        if claims.get("typ") != "refresh":
            raise UnauthorizedError("Token inválido.")

        token_hash = _sha256(refresh_token)
        stored = self._repo.get_active_by_hash(token_hash)
        if stored is None:
            raise UnauthorizedError("Refresh token inválido ou revogado.")

        # expiração adicional (além do jwt.decode)
        if stored.expires_at < datetime.utcnow():
            self._repo.revoke(token_id=stored.id, reason="expired")
            raise UnauthorizedError("Refresh token expirado.")

        user_id = stored.user_id

        new_refresh = self._jwt.issue_refresh_token(subject=str(user_id))
        new_claims = self._jwt.decode(new_refresh)

        # revoga o antigo e vincula ao novo
        self._repo.revoke(token_id=stored.id, reason="rotated", replaced_by_jti=str(new_claims["jti"]))

        # grava o novo
        self.store_refresh_token(user_id=user_id, refresh_token=new_refresh)

        return user_id, new_refresh

    def revoke(self, *, refresh_token: str, reason: str = "logout") -> None:
        token_hash = _sha256(refresh_token)
        stored = self._repo.get_active_by_hash(token_hash)
        if stored is None:
            return
        self._repo.revoke(token_id=stored.id, reason=reason)
