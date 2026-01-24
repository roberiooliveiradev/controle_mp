# app/infrastructure/realtime/socketio_message_notifier.py
from __future__ import annotations

from app.core.interfaces.message_notifier import MessageCreatedEvent, MessageNotifier
from app.infrastructure.realtime.socketio_server import socketio


class SocketIOMessageNotifier(MessageNotifier):
    def notify_message_created(self, event: MessageCreatedEvent) -> None:
        payload = {
            "conversation_id": event.conversation_id,
            "message_id": event.message_id,
            "sender_id": event.sender_id,
            "body": event.body,
            "created_at": event.created_at_iso,
        }

        # ✅ extras (só se vier)
        if event.preview is not None:
            payload["preview"] = event.preview

        if event.sender is not None:
            payload["sender"] = event.sender

        if event.conversation is not None:
            payload["conversation"] = event.conversation

        if event.message is not None:
            payload["message"] = event.message

        if event.has_files is not None:
            payload["has_files"] = bool(event.has_files)

        if event.files_count is not None:
            payload["files_count"] = int(event.files_count)

        if event.message_type_id is not None:
            payload["message_type_id"] = int(event.message_type_id)

        if event.message_type_code is not None:
            payload["message_type_code"] = str(event.message_type_code)

        # 1) room
        room = f"conversation:{event.conversation_id}"
        socketio.emit("message:new", payload, room=room)

        # 2) fallback global (não depender de join)
        socketio.emit("message:new", payload)
