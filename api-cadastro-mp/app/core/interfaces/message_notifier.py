# app/core/interfaces/message_notifier.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class MessageCreatedEvent:
    conversation_id: int
    message_id: int
    sender_id: int
    body: str | None
    created_at_iso: str


class MessageNotifier(Protocol):
    def notify_message_created(self, event: MessageCreatedEvent) -> None:
        ...
