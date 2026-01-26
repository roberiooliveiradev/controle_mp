# app/api/routes/user_routes.py

from __future__ import annotations

from flask import Blueprint, jsonify, request, g

from app.api.schemas.user_schema import (
    CreateUserRequest,
    UpdateUserRequest,
    UserResponse,
    AdminUpdateUserRequest,
    AdminUserResponse,
    AdminUsersListResponse,
)

from app.infrastructure.database.session import db_session
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

from app.api.middlewares.auth_middleware import require_auth, require_roles

from app.services.audit_service import AuditService
from app.repositories.audit_log_repository import AuditLogRepository


bp_users = Blueprint("users", __name__, url_prefix="/users")


# -------------------------
# Helpers
# -------------------------

def _auth_user() -> tuple[int, int]:
    auth = getattr(g, "auth", None)
    return int(auth["sub"]), int(auth["role_id"])


def _build_service(session) -> UserService:
    return UserService(UserRepository(session))


def _build_audit(session) -> AuditService:
    return AuditService(AuditLogRepository(session))


# -------------------------
# Rotas públicas
# -------------------------

@bp_users.post("")
def create_user():
    payload = CreateUserRequest.model_validate(request.get_json(force=True))

    with db_session() as session:
        service = _build_service(session)
        audit = _build_audit(session)

        created = service.create_user(**payload.model_dump())

        audit.log(
            entity_name="tbUsers",
            entity_id=int(created.id),
            action_name="CREATED",
            user_id=None,  # criação pública (sem auth)
            details=f"email={created.email}; role_id={created.role_id}",
        )

    response = UserResponse(
        id=created.id,
        full_name=created.full_name,
        email=created.email,
        role_id=created.role_id,
    )

    return jsonify(response.model_dump()), 201


@bp_users.get("")
def list_users():
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))

    with db_session() as session:
        service = _build_service(session)
        users = service.list_users(limit=limit, offset=offset)

    return jsonify(
        [
            UserResponse(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role_id=u.role_id,
            ).model_dump()
            for u in users
        ]
    ), 200


# -------------------------
# Minha conta
# -------------------------

@bp_users.put("/<int:user_id>")
@require_auth
def update_user(user_id: int):
    """
    Minha conta: exige current_password no payload.
    """
    auth_user_id, _ = _auth_user()

    payload = UpdateUserRequest.model_validate(request.get_json(force=True))
    data = payload.model_dump(exclude_none=True)

    current_password = data.pop("current_password")

    with db_session() as session:
        service = _build_service(session)
        audit = _build_audit(session)

        updated = service.update_user(
            user_id=user_id,
            current_password=current_password,
            **data,
        )

        audit.log(
            entity_name="tbUsers",
            entity_id=int(user_id),
            action_name="UPDATED",
            user_id=int(auth_user_id),
            details=f"self_update; changed_keys={list(data.keys())}",
        )

    return jsonify(
        UserResponse(
            id=updated.id,
            full_name=updated.full_name,
            email=updated.email,
            role_id=updated.role_id,
        ).model_dump()
    ), 200


@bp_users.delete("/<int:user_id>")
@require_auth
def delete_user(user_id: int):
    auth_user_id, _ = _auth_user()

    with db_session() as session:
        service = _build_service(session)
        audit = _build_audit(session)

        service.delete_user(user_id=user_id)

        audit.log(
            entity_name="tbUsers",
            entity_id=int(user_id),
            action_name="DELETED",
            user_id=int(auth_user_id),
            details="user deleted (self or admin)",
        )

    return ("", 204)


# -------------------------
# ADMIN
# -------------------------

@bp_users.get("/admin")
@require_auth
@require_roles(1)
def admin_list_users():
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))
    include_deleted = request.args.get("include_deleted", "1") in ("1", "true", "True")

    with db_session() as session:
        service = _build_service(session)
        users, total = service.admin_list_users(
            limit=limit,
            offset=offset,
            include_deleted=include_deleted,
        )

    items = [
        AdminUserResponse(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role_id=u.role_id,
            is_deleted=bool(u.is_deleted),
            created_at=u.created_at,
            updated_at=u.updated_at,
            last_login=u.last_login,
        )
        for u in users
    ]

    return jsonify(
        AdminUsersListResponse(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
        ).model_dump()
    ), 200


@bp_users.put("/<int:user_id>/admin")
@require_auth
@require_roles(1)
def admin_update_user(user_id: int):
    admin_user_id, _ = _auth_user()

    payload = AdminUpdateUserRequest.model_validate(request.get_json(force=True))
    data = payload.model_dump(exclude_none=True)

    with db_session() as session:
        service = _build_service(session)
        audit = _build_audit(session)

        updated = service.admin_update_user(user_id=user_id, **data)

        audit.log(
            entity_name="tbUsers",
            entity_id=int(user_id),
            action_name="UPDATED",
            user_id=int(admin_user_id),
            details=f"admin_update; changed_keys={list(data.keys())}",
        )

    return jsonify(
        AdminUserResponse(
            id=updated.id,
            full_name=updated.full_name,
            email=updated.email,
            role_id=updated.role_id,
            is_deleted=bool(updated.is_deleted),
            created_at=updated.created_at,
            updated_at=updated.updated_at,
            last_login=updated.last_login,
        ).model_dump()
    ), 200
