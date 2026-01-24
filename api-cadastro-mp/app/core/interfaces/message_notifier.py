# app/core/interfaces/message_notifier.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class MessageCreatedEvent:
    conversation_id: int
    message_id: int
    sender_id: int
    body: str | None
    created_at_iso: str

    # ✅ NOVOS (opcionais para compatibilidade)
    message: dict[str, Any] | None = None          # objeto completo (schema-like)
    conversation: dict[str, Any] | None = None     # mini/full
    sender: dict[str, Any] | None = None           # mini
    preview: str | None = None                     # body cortado/limpo

    has_files: bool | None = None
    files_count: int | None = None
    message_type_id: int | None = None
    message_type_code: str | None = None


class MessageNotifier(Protocol):
    def notify_message_created(self, event: MessageCreatedEvent) -> None:
        ...
