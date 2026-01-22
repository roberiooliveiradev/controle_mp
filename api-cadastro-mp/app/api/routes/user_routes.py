# app/api/routes/user_routes.py

from flask import Blueprint, jsonify, request

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

# ✅ ajuste os imports abaixo conforme seus middlewares reais
from app.api.middlewares.auth_middleware import require_auth, require_roles


bp_users = Blueprint("users", __name__, url_prefix="/users")


@bp_users.post("")
def create_user():
    payload = CreateUserRequest.model_validate(request.get_json(force=True))
    with db_session() as session:
        service = UserService(UserRepository(session))
        created = service.create_user(**payload.model_dump())

    response = UserResponse(id=created.id, full_name=created.full_name, email=created.email, role_id=created.role_id)
    return jsonify(response.model_dump()), 201


@bp_users.get("")
def list_users():
    # rota pública do app (não-admin): mantém como estava
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))

    with db_session() as session:
        service = UserService(UserRepository(session))
        users = service.list_users(limit=limit, offset=offset)

    return jsonify(
        [UserResponse(id=u.id, full_name=u.full_name, email=u.email, role_id=u.role_id).model_dump() for u in users]
    ), 200


@bp_users.put("/<int:user_id>")
@require_auth
def update_user(user_id: int):
    """
    Minha conta: exige current_password no payload.
    """
    payload = UpdateUserRequest.model_validate(request.get_json(force=True))
    data = payload.model_dump(exclude_none=True)

    current_password = data.pop("current_password")

    with db_session() as session:
        service = UserService(UserRepository(session))
        updated = service.update_user(user_id=user_id, current_password=current_password, **data)

    return jsonify(
        UserResponse(id=updated.id, full_name=updated.full_name, email=updated.email, role_id=updated.role_id).model_dump()
    ), 200


@bp_users.delete("/<int:user_id>")
@require_auth
def delete_user(user_id: int):
    with db_session() as session:
        service = UserService(UserRepository(session))
        service.delete_user(user_id=user_id)
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
        service = UserService(UserRepository(session))
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
    payload = AdminUpdateUserRequest.model_validate(request.get_json(force=True))
    data = payload.model_dump(exclude_none=True)

    with db_session() as session:
        service = UserService(UserRepository(session))
        updated = service.admin_update_user(user_id=user_id, **data)

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
