# app/infrastructure/security/jwt_provider.py

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt

from app.config.settings import settings
from app.core.exceptions import UnauthorizedError


class JwtProvider:
    def __init__(self) -> None:
        self._secret = settings.jwt_secret
        self._issuer = settings.jwt_issuer
        self._audience = settings.jwt_audience
        self._algorithm = "HS256"

    def issue_token(self, *, subject: str, payload: dict, minutes: int, token_type: str) -> str:
        now = datetime.now(tz=timezone.utc)
        exp = now + timedelta(minutes=minutes)

        claims = {
            "iss": self._issuer,
            "aud": self._audience,
            "sub": str(subject),
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
            "jti": uuid4().hex,
            "typ": token_type,  # "access" | "refresh"
        }
        claims.update(payload)
        return jwt.encode(claims, self._secret, algorithm=self._algorithm)

    def issue_access_token(self, *, subject: str, payload: dict, minutes: int = 0) -> str:
        # se minutes não for passado, usa settings.jwt_access_minutes
        ttl = minutes if minutes and minutes > 0 else settings.jwt_access_minutes
        return self.issue_token(subject=subject, payload=payload, minutes=ttl, token_type="access")

    def issue_refresh_token(self, *, subject: str, minutes: int = 0) -> str:
        # refresh token deve ser minimalista
        ttl = minutes if minutes and minutes > 0 else settings.jwt_refresh_minutes
        return self.issue_token(subject=subject, payload={}, minutes=ttl, token_type="refresh")

    def decode(self, token: str) -> dict:
        try:
            return jwt.decode(
                token,
                self._secret,
                algorithms=[self._algorithm],
                audience=self._audience,
                issuer=self._issuer,
                options={"require": ["exp", "iat", "sub", "jti", "typ"]},
            )
        except jwt.ExpiredSignatureError as e:
            raise UnauthorizedError("Token expirado.") from e
        except jwt.InvalidTokenError as e:
            raise UnauthorizedError("Token inválido.") from e
