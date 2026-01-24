# app/infrastructure/realtime/socketio_conversation_notifier.py
from __future__ import annotations

from app.core.interfaces.conversation_notifier import (
    ConversationNotifier,
    ConversationCreatedEvent,
)
from app.infrastructure.realtime.socketio_server import socketio


class SocketIOConversationNotifier(ConversationNotifier):
    def notify_conversation_created(self, event: ConversationCreatedEvent) -> None:
        payload = {
            "conversation_id": event.conversation_id,
            "title": event.title,
            "created_by": event.created_by,
            "assigned_to": event.assigned_to,
            "created_at": event.created_at_iso,
        }

        # ✅ extras
        if event.conversation is not None:
            payload["conversation"] = event.conversation
        if event.creator is not None:
            payload["creator"] = event.creator
        if event.assignee is not None:
            payload["assignee"] = event.assignee

        socketio.emit("conversation:new", payload)
