# app/core/interfaces/request_notifier.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class RequestCreatedEvent:
    request_id: int
    message_id: int
    conversation_id: int
    created_by: int
    created_at_iso: str


@dataclass(frozen=True)
class RequestItemChangedEvent:
    request_id: int
    item_id: int
    message_id: int
    conversation_id: int
    changed_by: int
    change_kind: str  # "STATUS" | "FIELDS" | "ITEM" | "DELETE" | etc.
    request_status_id: int | None
    updated_at_iso: str


class RequestNotifier(Protocol):
    def notify_request_created(self, event: RequestCreatedEvent) -> None:
        ...

    def notify_request_item_changed(self, event: RequestItemChangedEvent) -> None:
        ...
