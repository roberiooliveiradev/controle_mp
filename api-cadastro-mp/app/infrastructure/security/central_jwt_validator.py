# app/infrastructure/security/central_jwt_validator.py
from __future__ import annotations

import logging

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError

from app.config.settings import settings
from app.core.exceptions import UnauthorizedError

logger = logging.getLogger(__name__)


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

        # Alguns proxies/WAF (ex. na frente de minhadelpi.com.br) bloqueiam
        # User-Agent padrão do urllib (Python-urllib/*) com 403 no endpoint JWKS.
        self._jwks_client = PyJWKClient(
            settings.central_jwks_url,
            timeout=10,
            headers={
                "User-Agent": "ControleMP-SSO/1.0",
                "Accept": "application/json",
            },
        )
        self._issuer = settings.central_jwt_issuer
        self._audience = settings.central_jwt_audience
        self._verify_audience = settings.central_jwt_verify_audience

    def decode(self, token: str) -> dict:
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
        except PyJWKClientConnectionError as exc:
            logger.exception(
                "Falha ao buscar JWKS para SSO (url=%s)",
                settings.central_jwks_url,
            )
            raise UnauthorizedError(
                "Não foi possível validar o token SSO (JWKS indisponível)."
            ) from exc
        except PyJWKClientError as exc:
            logger.warning("Erro ao resolver chave JWKS: %s", exc)
            raise UnauthorizedError("Token SSO inválido.") from exc

        decode_options: dict = {
            "require": ["exp", "sub", "iss"],
        }
        if not self._verify_audience:
            decode_options["verify_aud"] = False

        decode_kwargs: dict = {
            "algorithms": ["RS256"],
            "issuer": self._issuer,
            "options": decode_options,
        }
        if self._verify_audience:
            decode_kwargs["audience"] = self._audience

        try:
            return jwt.decode(
                token,
                signing_key.key,
                **decode_kwargs,
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