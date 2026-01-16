# app/api/routes/conversation_routes.py
from flask import Blueprint, jsonify, g, request

from app.api.middlewares.auth_middleware import require_auth
from app.infrastructure.database.session import db_session
from app.repositories.conversation_repository import ConversationRepository
from app.services.conversation_service import ConversationService
from app.api.schemas.conversation_schema import (
    ConversationListItemResponse,
    ConversationResponse,
    CreateConversationRequest,
    UpdateConversationRequest,
    UserMiniResponse,
)

bp_conv = Blueprint("conversations", __name__, url_prefix="/conversations")


def _auth_user():
    auth = getattr(g, "auth", None)
    user_id = int(auth["sub"])
    role_id = int(auth["role_id"])
    return user_id, role_id


def _row_to_response(row) -> dict:
    conv, creator, assignee = row
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        has_flag=conv.has_flag,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        created_by=UserMiniResponse(id=creator.id, full_name=creator.full_name, email=creator.email),
        assigned_to=(
            UserMiniResponse(id=assignee.id, full_name=assignee.full_name, email=assignee.email)
            if assignee
            else None
        ),
    ).model_dump()


@bp_conv.get("")
@require_auth
def list_conversations():
    limit = max(1, min(int(request.args.get("limit", 50)), 200))
    offset = max(0, int(request.args.get("offset", 0)))

    user_id, role_id = _auth_user()

    with db_session() as session:
        service = ConversationService(ConversationRepository(session))
        rows = service.list_conversations(user_id=user_id, role_id=role_id, limit=limit, offset=offset)

    payload = []
    for row in rows:
        payload.append(
            ConversationListItemResponse(**_row_to_response(row)).model_dump()
        )

    return jsonify(payload), 200


@bp_conv.post("")
@require_auth
def create_conversation():
    user_id, role_id = _auth_user()
    payload = CreateConversationRequest.model_validate(request.get_json(force=True))

    with db_session() as session:
        service = ConversationService(ConversationRepository(session))
        conv = service.create_conversation(
            title=payload.title,
            created_by=user_id,
            assigned_to=payload.assigned_to_id,
            has_flag=payload.has_flag,
        )
        # refaz fetch com join pra devolver UserMiniResponse
        row = service.get_conversation(conversation_id=conv.id, user_id=user_id, role_id=role_id)

    return jsonify(_row_to_response(row)), 201


@bp_conv.get("/<int:conversation_id>")
@require_auth
def get_conversation(conversation_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        service = ConversationService(ConversationRepository(session))
        row = service.get_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

    return jsonify(_row_to_response(row)), 200


@bp_conv.patch("/<int:conversation_id>")
@require_auth
def update_conversation(conversation_id: int):
    user_id, role_id = _auth_user()
    payload = UpdateConversationRequest.model_validate(request.get_json(force=True))

    with db_session() as session:
        service = ConversationService(ConversationRepository(session))
        service.update_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            role_id=role_id,
            title=payload.title,
            has_flag=payload.has_flag,
            assigned_to=payload.assigned_to_id,
        )
        row = service.get_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

    return jsonify(_row_to_response(row)), 200


@bp_conv.delete("/<int:conversation_id>")
@require_auth
def delete_conversation(conversation_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        service = ConversationService(ConversationRepository(session))
        service.delete_conversation(conversation_id=conversation_id, user_id=user_id, role_id=role_id)

    return ("", 204)
