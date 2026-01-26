# app/infrastructure/realtime/socketio_product_notifier.py
from __future__ import annotations

from app.core.interfaces.product_notifier import (
    ProductNotifier,
    ProductCreatedEvent,
    ProductUpdatedEvent,
    ProductFlagChangedEvent,
)
from app.infrastructure.realtime.socketio_server import socketio


class SocketIOProductNotifier(ProductNotifier):
    def notify_product_created(self, event: ProductCreatedEvent) -> None:
        payload = {
            "product_id": event.product_id,
            "created_by": event.created_by,
            "created_at": event.created_at_iso,
            "codigo_atual": event.codigo_atual,
            "descricao": event.descricao,
        }
        socketio.emit("product:created", payload)  # global

    def notify_product_updated(self, event: ProductUpdatedEvent) -> None:
        payload = {
            "product_id": event.product_id,
            "updated_by": event.updated_by,
            "updated_at": event.updated_at_iso,
            "codigo_atual": event.codigo_atual,
            "descricao": event.descricao,
        }
        socketio.emit("product:updated", payload)  # global

    def notify_product_flag_changed(self, event: ProductFlagChangedEvent) -> None:
        payload = {
            "product_id": event.product_id,
            "field_id": event.field_id,
            "field_tag": event.field_tag,
            "field_flag": event.field_flag,
            "changed_by": event.changed_by,
            "changed_at": event.changed_at_iso,
        }
        socketio.emit("product:flag_changed", payload)  # global
