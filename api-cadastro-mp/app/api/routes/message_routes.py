# app/api/routes/message_routes.py

from flask import Blueprint, jsonify, g, request

from app.api.middlewares.auth_middleware import require_auth
from app.api.schemas.message_schema import (
    CreateMessageRequestInput,
    MarkReadRequest,
    MessageResponse,
    MessageFileResponse,
    RequestMiniResponse,
    UserMiniResponse,
)
from app.infrastructure.database.session import db_session
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.conversation_participant_repository import ConversationParticipantRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.message_file_repository import MessageFileRepository
from app.repositories.request_repository import RequestRepository
from app.repositories.message_type_repository import MessageTypeRepository  
from app.services.message_service import MessageService

from app.infrastructure.realtime.socketio_message_notifier import (
    SocketIOMessageNotifier,
)


bp_msg = Blueprint(
    "messages",
    __name__,
    url_prefix="/conversations/<int:conversation_id>/messages",
)


def _auth_user():
    auth = getattr(g, "auth", None)
    return int(auth["sub"]), int(auth["role_id"])


def _pack_response(item: dict) -> dict:
    msg = item["msg"]
    sender = item["sender"]
    files = item["files"]
    req = item["request"]
    is_read = bool(item["is_read"])

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        body=msg.body,
        message_type_id=msg.message_type_id,
        created_at=msg.created_at,
        updated_at=msg.updated_at,
        sender=UserMiniResponse(id=sender.id, full_name=sender.full_name, email=sender.email),
        files=[
            MessageFileResponse(
                id=f.id,
                original_name=f.original_name,
                stored_name=f.stored_name,
                content_type=f.content_type,
                size_bytes=f.size_bytes,
                sha256=f.sha256,
                created_at=f.created_at,
            )
            for f in files
        ],
        request=(
            RequestMiniResponse(
                id=req.id,
                message_id=req.message_id,
                created_by=req.created_by,
                created_at=req.created_at,
            )
            if req
            else None
        ),
        is_read=is_read,
    ).model_dump()


def _build_service(session) -> MessageService:
    """Centraliza a criação do service pra evitar repetição em todas as rotas."""
    return MessageService(
        conv_repo=ConversationRepository(session),
        part_repo=ConversationParticipantRepository(session),
        msg_repo=MessageRepository(session),
        file_repo=MessageFileRepository(session),
        req_repo=RequestRepository(session),
        type_repo=MessageTypeRepository(session),  
        notifier=SocketIOMessageNotifier(),
    )


@bp_msg.get("")
@require_auth
def list_messages(conversation_id: int):
    user_id, role_id = _auth_user()
    limit = max(1, min(int(request.args.get("limit", 100)), 500))
    offset = max(0, int(request.args.get("offset", 0)))

    with db_session() as session:
        svc = _build_service(session)
        items = svc.list_messages(
            conversation_id=conversation_id,
            user_id=user_id,
            role_id=role_id,
            limit=limit,
            offset=offset,
        )

    return jsonify([_pack_response(x) for x in items]), 200


@bp_msg.post("")
@require_auth
def create_message(conversation_id: int):
    user_id, role_id = _auth_user()
    payload = CreateMessageRequestInput.model_validate(request.get_json(force=True))

    files_payload = [f.model_dump() for f in (payload.files or [])] if payload.files else None

    with db_session() as session:
        svc = _build_service(session)
        msg = svc.create_message(
            conversation_id=conversation_id,
            user_id=user_id,
            role_id=role_id,
            message_type_id=payload.message_type_id,
            body=payload.body,
            files=files_payload,
            create_request=payload.create_request,
        )
        item = svc.get_message(
            conversation_id=conversation_id,
            message_id=msg.id,
            user_id=user_id,
            role_id=role_id,
        )

    return jsonify(_pack_response(item)), 201


@bp_msg.get("/<int:message_id>")
@require_auth
def get_message(conversation_id: int, message_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = _build_service(session)
        item = svc.get_message(
            conversation_id=conversation_id,
            message_id=message_id,
            user_id=user_id,
            role_id=role_id,
        )

    return jsonify(_pack_response(item)), 200


@bp_msg.post("/read")
@require_auth
def mark_read(conversation_id: int):
    user_id, role_id = _auth_user()
    payload = MarkReadRequest.model_validate(request.get_json(force=True))

    with db_session() as session:
        svc = _build_service(session)
        changed = svc.mark_read(
            conversation_id=conversation_id,
            user_id=user_id,
            role_id=role_id,
            message_ids=payload.message_ids,
        )

    return jsonify({"updated": bool(changed)}), 200


@bp_msg.delete("/<int:message_id>")
@require_auth
def delete_message(conversation_id: int, message_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = _build_service(session)
        svc.delete_message(
            conversation_id=conversation_id,
            message_id=message_id,
            user_id=user_id,
            role_id=role_id,
        )

    return ("", 204)
