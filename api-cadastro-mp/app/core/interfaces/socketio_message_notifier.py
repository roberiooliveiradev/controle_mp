# app/infrastructure/realtime/socketio_message_notifier.py
from __future__ import annotations

from app.core.interfaces.message_notifier import MessageCreatedEvent, MessageNotifier
from app.infrastructure.realtime.socketio_server import socketio


class SocketIOMessageNotifier(MessageNotifier):
    def notify_message_created(self, event: MessageCreatedEvent) -> None:
        room = f"conversation:{event.conversation_id}"
        payload = {
            "conversation_id": event.conversation_id,
            "message_id": event.message_id,
            "sender_id": event.sender_id,
            "body": event.body,
            "created_at": event.created_at_iso,
        }
        socketio.emit("message:new", payload, room=room)
