# app/infrastructure/security/central_jwt_validator.py
from __future__ import annotations

import jwt
from jwt import PyJWKClient

from app.config.settings import settings
from app.core.exceptions import UnauthorizedError


class CentralJwtValidator:
    """
    Valida o access_token emitido pelo Keycloak/Minha DELPI.

    Este token não substitui o JWT local do Controle MP.
    Ele serve apenas para autenticar o usuário central e iniciar
    uma sessão local no Controle MP.
    """

    def __init__(self) -> None:
        if not settings.central_jwks_url:
            raise RuntimeError("CENTRAL_JWKS_URL não configurado.")
        if not settings.central_jwt_issuer:
            raise RuntimeError("CENTRAL_JWT_ISSUER não configurado.")

        self._jwks_client = PyJWKClient(settings.central_jwks_url)
        self._issuer = settings.central_jwt_issuer
        self._audience = settings.central_jwt_audience

    def decode(self, token: str) -> dict:
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)

            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
                options={
                    "require": ["exp", "iat", "sub"],
                },
            )
        except jwt.ExpiredSignatureError as exc:
            raise UnauthorizedError("Token SSO expirado.") from exc
        except jwt.InvalidTokenError as exc:
            raise UnauthorizedError("Token SSO inválido.") from exc

    def extract_identity(self, token: str) -> dict:
        claims = self.decode(token)

        email = claims.get("email")
        if not email:
            raise UnauthorizedError("Token SSO sem e-mail.")

        full_name = (
            claims.get("name")
            or claims.get("preferred_username")
            or email.split("@")[0]
        )

        return {
            "sub": str(claims.get("sub")),
            "email": str(email).strip().lower(),
            "full_name": str(full_name).strip(),
            "claims": claims,
        }