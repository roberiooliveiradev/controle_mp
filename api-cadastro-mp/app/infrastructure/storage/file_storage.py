# app/infrastructure/storage/file_storage.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, BinaryIO


@dataclass(frozen=True)
class StoredFile:
    original_name: str
    stored_name: str
    content_type: str | None
    size_bytes: int
    sha256: str


class FileStorage(Protocol):
    def save(
        self,
        *,
        fileobj: BinaryIO,
        original_name: str,
        content_type: str | None,
    ) -> StoredFile:
        """Persiste um arquivo e retorna metadados para serem usados no domínio (MessageFiles)."""
        raise NotImplementedError

    def delete(self, *, stored_name: str) -> bool:
        """Remove arquivo do storage (best-effort). Retorna True se removeu, False se não existia."""
        raise NotImplementedError
