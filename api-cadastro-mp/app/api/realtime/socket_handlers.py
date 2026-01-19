# app/api/realtime/socket_handlers.py
from __future__ import annotations

from flask import request
from flask_socketio import disconnect, join_room, leave_room

import jwt

from app.config.settings import settings
from app.infrastructure.realtime.socketio_server import socketio


def _get_bearer_token() -> str | None:
    # 1) Authorization: Bearer <token>
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()

    # 2) querystring ?token=...
    token = request.args.get("token")
    if token:
        return str(token).strip()

    return None


def register_socket_handlers() -> None:
    @socketio.on("connect")
    def on_connect():
        token = _get_bearer_token()
        if not token:
            return disconnect()

        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                audience=getattr(settings, "jwt_audience", None),
                issuer=getattr(settings, "jwt_issuer", None),
                options={"require": ["sub", "exp", "iat"]},
            )
        except Exception:
            return disconnect()

        # salva user_id no environ da conexão
        request.environ["auth_user_id"] = int(payload["sub"])

    @socketio.on("conversation:join")
    def on_join(data: dict):
        conversation_id = int(data.get("conversation_id"))
        join_room(f"conversation:{conversation_id}")
        socketio.emit("conversation:joined", {"conversation_id": conversation_id})

    @socketio.on("conversation:leave")
    def on_leave(data: dict):
        conversation_id = int(data.get("conversation_id"))
        leave_room(f"conversation:{conversation_id}")
        socketio.emit("conversation:left", {"conversation_id": conversation_id})
