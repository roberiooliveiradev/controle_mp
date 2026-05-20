# app/infrastructure/realtime/composite_notifiers.py
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.interfaces.conversation_notifier import (
    ConversationCreatedEvent,
    ConversationNotifier,
)
from app.core.interfaces.message_notifier import MessageCreatedEvent, MessageNotifier
from app.core.interfaces.request_notifier import (
    RequestCreatedEvent,
    RequestItemChangedEvent,
    RequestNotifier,
)
from app.infrastructure.integrations.delpi_notification_service import DelpiNotificationService
from app.infrastructure.realtime.socketio_conversation_notifier import (
    SocketIOConversationNotifier,
)
from app.infrastructure.realtime.socketio_message_notifier import SocketIOMessageNotifier
from app.infrastructure.realtime.socketio_request_notifier import SocketIORequestNotifier


class CompositeMessageNotifier(MessageNotifier):
    def __init__(self, socket: MessageNotifier, delpi: DelpiNotificationService) -> None:
        self._socket = socket
        self._delpi = delpi

    def notify_message_created(self, event: MessageCreatedEvent) -> None:
        self._socket.notify_message_created(event)
        try:
            self._delpi.on_message_created(event)
        except Exception:
            pass


class CompositeRequestNotifier(RequestNotifier):
    def __init__(self, socket: RequestNotifier, delpi: DelpiNotificationService) -> None:
        self._socket = socket
        self._delpi = delpi

    def notify_request_created(self, event: RequestCreatedEvent) -> None:
        self._socket.notify_request_created(event)
        try:
            self._delpi.on_request_created(event)
        except Exception:
            pass

    def notify_request_item_changed(self, event: RequestItemChangedEvent) -> None:
        self._socket.notify_request_item_changed(event)
        try:
            self._delpi.on_request_item_changed(event)
        except Exception:
            pass


class CompositeConversationNotifier(ConversationNotifier):
    def __init__(
        self, socket: ConversationNotifier, delpi: DelpiNotificationService
    ) -> None:
        self._socket = socket
        self._delpi = delpi

    def notify_conversation_created(self, event: ConversationCreatedEvent) -> None:
        self._socket.notify_conversation_created(event)
        try:
            self._delpi.on_conversation_created(event)
        except Exception:
            pass


def build_message_notifier(session: Session) -> MessageNotifier:
    delpi = DelpiNotificationService(session)
    return CompositeMessageNotifier(SocketIOMessageNotifier(), delpi)


def build_request_notifier(session: Session) -> RequestNotifier:
    delpi = DelpiNotificationService(session)
    return CompositeRequestNotifier(SocketIORequestNotifier(), delpi)


def build_conversation_notifier(session: Session) -> ConversationNotifier:
    delpi = DelpiNotificationService(session)
    return CompositeConversationNotifier(SocketIOConversationNotifier(), delpi)
