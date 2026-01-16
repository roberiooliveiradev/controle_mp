from flask import Blueprint, jsonify, request, g

from app.api.middlewares.auth_middleware import require_auth
from app.api.schemas.user_schema import LoginRequest, RefreshRequest, TokenPairResponse, LogoutRequest
from app.infrastructure.database.session import db_session
from app.infrastructure.security.jwt_provider import JwtProvider
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.revoked_token_repository import RevokedTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.refresh_token_service import RefreshTokenService
from app.services.user_service import UserService

bp_auth = Blueprint("auth", __name__, url_prefix="/auth")


@bp_auth.post("/login")
def login():
    payload = LoginRequest.model_validate(request.get_json(force=True))

    with db_session() as session:
        audit = AuditService(AuditLogRepository(session))

        user_service = UserService(UserRepository(session))
        try:
            user = user_service.authenticate(email=payload.email, password=payload.password)
        except Exception:
            audit.log(entity_name="auth", action_name="LOGIN_FAILED", user_id=None, details=f"email={payload.email}")
            raise

        jwt_provider = JwtProvider()
        access = jwt_provider.issue_access_token(
            subject=str(user.id),
            payload={"email": user.email, "role_id": user.role_id, "full_name": user.full_name},
            minutes=60,
        )
        refresh = jwt_provider.issue_refresh_token(subject=str(user.id), minutes=60 * 24 * 7)

        refresh_svc = RefreshTokenService(jwt_provider=jwt_provider, repo=RefreshTokenRepository(session))
        refresh_svc.store_refresh_token(user_id=user.id, refresh_token=refresh)

        audit.log(entity_name="auth", action_name="LOGIN_SUCCESS", user_id=user.id)

    return jsonify(TokenPairResponse(access_token=access, refresh_token=refresh).model_dump()), 200


@bp_auth.post("/refresh")
def refresh():
    payload = RefreshRequest.model_validate(request.get_json(force=True))

    with db_session() as session:
        jwt_provider = JwtProvider()
        audit = AuditService(AuditLogRepository(session))

        refresh_svc = RefreshTokenService(jwt_provider=jwt_provider, repo=RefreshTokenRepository(session))
        user_id, new_refresh = refresh_svc.rotate(refresh_token=payload.refresh_token)

        # novo access
        user_repo = UserRepository(session)
        user = user_repo.get_by_id(user_id)
        if user is None:
            audit.log(entity_name="auth", action_name="REFRESH_FAILED", user_id=user_id, details="user_not_found")
            return ("", 401)

        new_access = jwt_provider.issue_access_token(
            subject=str(user.id),
            payload={"email": user.email, "role_id": user.role_id, "full_name": user.full_name},
            minutes=60,
        )

        audit.log(entity_name="auth", action_name="REFRESH_SUCCESS", user_id=user.id)

    return jsonify(TokenPairResponse(access_token=new_access, refresh_token=new_refresh).model_dump()), 200


@bp_auth.post("/logout")
@require_auth
def logout():
    # Logout real: revoga access (jti em tbRevokedTokens).
    # Se o refresh_token vier no body, revoga também o refresh (encerra sessão).
    payload = LogoutRequest.model_validate(request.get_json(silent=True) or {})

    auth_header = request.headers.get("Authorization", "")
    token = auth_header.split()[1]  # já validado pelo middleware

    with db_session() as session:
        jwt_provider = JwtProvider()
        audit = AuditService(AuditLogRepository(session))

        # revoga access token
        auth_service = AuthService(jwt_provider=jwt_provider, revoked_repo=RevokedTokenRepository(session))
        auth_service.revoke_access_token(token=token, reason="logout")

        # revoga refresh token (opcional)
        if payload.refresh_token:
            refresh_svc = RefreshTokenService(jwt_provider=jwt_provider, repo=RefreshTokenRepository(session))
            refresh_svc.revoke(refresh_token=payload.refresh_token, reason="logout")

        user_id = int(g.auth.get("sub"))
        audit.log(entity_name="auth", action_name="LOGOUT", user_id=user_id)

    return ("", 204)
