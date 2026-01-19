# app/core/interfaces/conversation_notifier.py
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ConversationCreatedEvent:
    conversation_id: int
    title: str
    created_by: int
    assigned_to: int | None
    created_at_iso: str


class ConversationNotifier(Protocol):
    def notify_conversation_created(self, event: ConversationCreatedEvent) -> None:
        ...
