# app/infrastructure/storage/local_file_storage.py
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

from app.infrastructure.storage.file_storage import FileStorage, StoredFile


@dataclass(frozen=True)
class LocalFileStorageConfig:
    base_path: str


class LocalFileStorage(FileStorage):
    def __init__(self, *, config: LocalFileStorageConfig) -> None:
        self._base = Path(config.base_path).expanduser().resolve()
        self._base.mkdir(parents=True, exist_ok=True)

    def _abs_path_from_stored(self, stored_name: str) -> Path:
        # stored_name é sempre relativo (ex: messages/2026/01/<uuid>)
        abs_path = (self._base / Path(stored_name)).resolve()

        # Segurança: garante que está dentro da base
        base_prefix = str(self._base) + os.sep
        if not str(abs_path).startswith(base_prefix):
            raise ValueError("Caminho inválido (fora do diretório base).")

        return abs_path

    def save(
        self,
        *,
        fileobj: BinaryIO,
        original_name: str,
        content_type: str | None,
    ) -> StoredFile:
        now = datetime.utcnow()
        rel_dir = Path("messages") / f"{now.year:04d}" / f"{now.month:02d}"
        abs_dir = (self._base / rel_dir).resolve()
        abs_dir.mkdir(parents=True, exist_ok=True)

        stored_filename = uuid4().hex
        rel_path = (rel_dir / stored_filename).as_posix()
        abs_path = self._abs_path_from_stored(rel_path)

        sha = hashlib.sha256()
        size = 0

        with open(abs_path, "wb") as out:
            while True:
                chunk = fileobj.read(1024 * 1024)  # 1MB
                if not chunk:
                    break
                out.write(chunk)
                sha.update(chunk)
                size += len(chunk)

        return StoredFile(
            original_name=original_name,
            stored_name=rel_path,
            content_type=content_type,
            size_bytes=size,
            sha256=sha.hexdigest(),
        )

    def delete(self, *, stored_name: str) -> bool:
        try:
            abs_path = self._abs_path_from_stored(stored_name)
        except ValueError:
            # Se alguém tentar apagar algo inválido, não apaga nada.
            return False

        try:
            abs_path.unlink(missing_ok=True)
            return True
        except FileNotFoundError:
            return False
        except OSError:
            # best-effort
            return False
