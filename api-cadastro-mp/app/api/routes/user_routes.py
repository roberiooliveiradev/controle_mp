# app/api/routes/user_routes.py

from flask import Blueprint, jsonify, request

from app.api.schemas.user_schema import CreateUserRequest, UpdateUserRequest, UserResponse
from app.infrastructure.database.session import db_session
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

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
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))

    with db_session() as session:
        service = UserService(UserRepository(session))
        users = service.list_users(limit=limit, offset=offset)

    return jsonify(
        [UserResponse(id=u.id, full_name=u.full_name, email=u.email, role_id=u.role_id).model_dump() for u in users]
    ), 200


@bp_users.put("/<int:user_id>")
def update_user(user_id: int):
    payload = UpdateUserRequest.model_validate(request.get_json(force=True))
    data = payload.model_dump(exclude_none=True)

    current_password = data.pop("current_password")  # ✅ obrigatório
    update_fields = data  # full_name/email/password (opcionais)

    with db_session() as session:
        service = UserService(UserRepository(session))
        updated = service.update_user(
            user_id=user_id,
            current_password=current_password,
            **update_fields,
        )

    return jsonify(
        UserResponse(id=updated.id, full_name=updated.full_name, email=updated.email, role_id=updated.role_id).model_dump()
    ), 200


@bp_users.delete("/<int:user_id>")
def delete_user(user_id: int):
    with db_session() as session:
        service = UserService(UserRepository(session))
        service.delete_user(user_id=user_id)
    return ("", 204)
