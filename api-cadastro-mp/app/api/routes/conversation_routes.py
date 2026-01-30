# app/api/routes/conversation_routes.py

from __future__ import annotations

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

from app.infrastructure.realtime.socketio_conversation_notifier import (
    SocketIOConversationNotifier,
)

from app.services.audit_service import AuditService
from app.repositories.audit_log_repository import AuditLogRepository

from app.core.audit.audit_entities import AuditEntity
from app.core.audit.audit_actions import AuditAction

bp_conv = Blueprint("conversations", __name__, url_prefix="/conversations")


# -------------------------
# Helpers
# -------------------------

def _build_service(session) -> ConversationService:
    return ConversationService(
        ConversationRepository(session),
        notifier=SocketIOConversationNotifier(),
    )


def _build_audit(session) -> AuditService:
    return AuditService(AuditLogRepository(session))


def _auth_user() -> tuple[int, int]:
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
        created_by=UserMiniResponse(
            id=creator.id, full_name=creator.full_name, email=creator.email),
        assigned_to=(
            UserMiniResponse(
                id=assignee.id, full_name=assignee.full_name, email=assignee.email)
            if assignee
            else None
        ),
    ).model_dump()


# -------------------------
# Rotas (consulta)
# -------------------------

@bp_conv.get("")
@require_auth
def list_conversations():
    limit = max(1, min(int(request.args.get("limit", 50)), 200))
    offset = max(0, int(request.args.get("offset", 0)))

    user_id, role_id = _auth_user()

    with db_session() as session:
        service = _build_service(session)
        rows = service.list_conversations(
            user_id=user_id,
            role_id=role_id,
            limit=limit,
            offset=offset,
        )

    payload = [ConversationListItemResponse(
        **_row_to_response(row)).model_dump() for row in rows]
    return jsonify(payload), 200


@bp_conv.get("/<int:conversation_id>")
@require_auth
def get_conversation(conversation_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        service = _build_service(session)
        row = service.get_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            role_id=role_id,
        )

    return jsonify(_row_to_response(row)), 200

@bp_conv.get("/unread-summary")
@require_auth
def get_unread_summary():
    user_id, _ = _auth_user()

    with db_session() as session:
        service = _build_service(session)
        summary = service.get_unread_summary(user_id=user_id)

    return jsonify(summary), 200

# -------------------------
# Rotas (mutação) + Auditoria
# -------------------------

@bp_conv.post("")
@require_auth
def create_conversation():
    user_id, role_id = _auth_user()
    payload = CreateConversationRequest.model_validate(
        request.get_json(force=True))

    with db_session() as session:
        service = _build_service(session)
        audit = _build_audit(session)

        conv = service.create_conversation(
            title=payload.title,
            created_by=user_id,
            assigned_to=payload.assigned_to_id,
            has_flag=payload.has_flag,
        )

        audit.log(
            entity_name=AuditEntity.CONVERSATION,
            entity_id=int(conv.id),
            action_name=AuditAction.CREATED,
            user_id=int(user_id),
            details=f"assigned_to={payload.assigned_to_id}; has_flag={bool(payload.has_flag)}",
        )

        row = service.get_conversation(
            conversation_id=conv.id, user_id=user_id, role_id=role_id)

    return jsonify(_row_to_response(row)), 201


@bp_conv.patch("/<int:conversation_id>")
@require_auth
def update_conversation(conversation_id: int):
    user_id, role_id = _auth_user()
    payload = UpdateConversationRequest.model_validate(
        request.get_json(force=True))

    with db_session() as session:
        service = _build_service(session)
        audit = _build_audit(session)

        service.update_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            role_id=role_id,
            title=payload.title,
            has_flag=payload.has_flag,
            assigned_to=payload.assigned_to_id,
        )

        audit.log(
            entity_name=AuditEntity.CONVERSATION,
            entity_id=int(conversation_id),
            action_name=AuditAction.UPDATED,
            user_id=int(user_id),
            details=f"changed=title,has_flag,assigned_to; assigned_to={payload.assigned_to_id}; has_flag={bool(payload.has_flag)}",
        )

        row = service.get_conversation(
            conversation_id=conversation_id, user_id=user_id, role_id=role_id)

    return jsonify(_row_to_response(row)), 200


@bp_conv.delete("/<int:conversation_id>")
@require_auth
def delete_conversation(conversation_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        service = _build_service(session)
        audit = _build_audit(session)

        service.delete_conversation(
            conversation_id=conversation_id, user_id=user_id, role_id=role_id)

        audit.log(
            entity_name=AuditEntity.CONVERSATION,
            entity_id=int(conversation_id),
            action_name=AuditAction.DELETED,
            user_id=int(user_id),
            details="conversation deleted",
        )

    return ("", 204)
