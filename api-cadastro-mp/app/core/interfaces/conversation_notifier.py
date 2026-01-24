# app/core/interfaces/conversation_notifier.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ConversationCreatedEvent:
    conversation_id: int
    title: str
    created_by: int
    assigned_to: int | None
    created_at_iso: str

    # ✅ NOVOS
    conversation: dict[str, Any] | None = None
    creator: dict[str, Any] | None = None
    assignee: dict[str, Any] | None = None


class ConversationNotifier(Protocol):
    def notify_conversation_created(self, event: ConversationCreatedEvent) -> None:
        ...
