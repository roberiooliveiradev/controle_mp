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

        # 1) envia para quem está na conversa (room)
        room = f"conversation:{event.conversation_id}"
        socketio.emit("message:new", payload, room=room)

        # 2) fallback: envia global (para não depender do join)
        socketio.emit("message:new", payload)
