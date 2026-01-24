# app/infrastructure/realtime/socketio_request_notifier.py
from __future__ import annotations

from app.core.interfaces.request_notifier import (
    RequestCreatedEvent,
    RequestItemChangedEvent,
    RequestNotifier,
)
from app.infrastructure.realtime.socketio_server import socketio

class SocketIORequestNotifier(RequestNotifier):
    def notify_request_created(self, event: RequestCreatedEvent) -> None:
        payload = {
            "request_id": event.request_id,
            "message_id": event.message_id,
            "conversation_id": event.conversation_id,
            "created_by": event.created_by,
            "created_at": event.created_at_iso,
        }
        if event.request is not None:
            payload["request"] = event.request

        room = f"conversation:{event.conversation_id}"
        socketio.emit("request:created", payload, room=room)
        socketio.emit("request:created", payload)  # ✅ fallback global (volta!)

    def notify_request_item_changed(self, event: RequestItemChangedEvent) -> None:
        payload = {
            "request_id": event.request_id,
            "item_id": event.item_id,
            "message_id": event.message_id,
            "conversation_id": event.conversation_id,
            "changed_by": event.changed_by,
            "change_kind": event.change_kind,
            "request_status_id": event.request_status_id,
            "updated_at": event.updated_at_iso,
        }
        if event.request is not None:
            payload["request"] = event.request
        if event.item is not None:
            payload["item"] = event.item

        room = f"conversation:{event.conversation_id}"
        socketio.emit("request:item_changed", payload, room=room)
        socketio.emit("request:item_changed", payload)  # ✅ fallback global (volta!)