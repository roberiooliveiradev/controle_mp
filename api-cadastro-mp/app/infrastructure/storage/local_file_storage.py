# app/infrastructure/storage/local_file_storage.py
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

from app.core.exceptions import ConflictError
from app.infrastructure.storage.file_storage import FileStorage, StoredFile


@dataclass(frozen=True)
class LocalFileStorageConfig:
    base_path: str


class LocalFileStorage(FileStorage):
    def __init__(self, *, config: LocalFileStorageConfig) -> None:
        # resolve e prepara base
        raw = (config.base_path or "").strip()
        if not raw:
            raise ConflictError("Storage de arquivos não configurado (FILES_BASE_PATH vazio).")

        self._base = Path(raw).expanduser().resolve()

        try:
            self._base.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            raise ConflictError(
                f"Sem permissão para criar/acessar a pasta de uploads: '{self._base}'. "
                "Verifique permissões do usuário do serviço e/ou ajuste FILES_BASE_PATH."
            )
        except FileNotFoundError:
            # raro, mas pode ocorrer por path inválido em algum segmento
            raise ConflictError(
                f"Caminho de uploads inválido: '{self._base}'. Verifique FILES_BASE_PATH."
            )
        except OSError as e:
            raise ConflictError(
                f"Falha ao inicializar storage local em '{self._base}': {e}"
            )

        # valida se é diretório e se é gravável
        if not self._base.exists() or not self._base.is_dir():
            raise ConflictError(f"Pasta de uploads inválida: '{self._base}' não é um diretório.")

        if not os.access(self._base, os.W_OK):
            raise ConflictError(
                f"Pasta de uploads sem permissão de escrita: '{self._base}'. "
                "Ajuste permissões (chown/chmod) ou use outro FILES_BASE_PATH."
            )

    def _abs_path_from_stored(self, stored_name: str) -> Path:
        # stored_name deve ser relativo (ex.: messages/2026/01/uuid)
        rel = Path(stored_name)
        abs_path = (self._base / rel).resolve()

        # anti path traversal
        base_str = str(self._base)
        abs_str = str(abs_path)
        if not (abs_str == base_str or abs_str.startswith(base_str + os.sep)):
            raise ValueError("stored_name inválido (path traversal).")

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

        try:
            abs_dir.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            raise ConflictError(
                f"Sem permissão para criar pasta de uploads: '{abs_dir}'. "
                "Verifique permissões do usuário do serviço."
            )
        except OSError as e:
            raise ConflictError(f"Falha ao preparar diretório de uploads '{abs_dir}': {e}")

        stored_filename = uuid4().hex
        rel_path = (rel_dir / stored_filename).as_posix()
        abs_path = self._abs_path_from_stored(rel_path)

        sha = hashlib.sha256()
        size = 0

        try:
            with open(abs_path, "wb") as out:
                while True:
                    chunk = fileobj.read(1024 * 1024)  # 1MB
                    if not chunk:
                        break
                    out.write(chunk)
                    sha.update(chunk)
                    size += len(chunk)
        except PermissionError:
            # melhor esforço: remove arquivo parcial se existir
            try:
                if abs_path.exists():
                    abs_path.unlink()
            except Exception:
                pass
            raise ConflictError(
                f"Sem permissão para gravar arquivo em '{abs_path}'. Verifique permissões da pasta de uploads."
            )
        except OSError as e:
            try:
                if abs_path.exists():
                    abs_path.unlink()
            except Exception:
                pass
            raise ConflictError(f"Falha ao salvar arquivo: {e}")

        return StoredFile(
            original_name=original_name,
            stored_name=rel_path,
            content_type=content_type,
            size_bytes=size,
            sha256=sha.hexdigest(),
        )

    def delete(self, *, stored_name: str) -> None:
        # best-effort delete; não quebra fluxo
        try:
            abs_path = self._abs_path_from_stored(stored_name)
            if abs_path.exists() and abs_path.is_file():
                abs_path.unlink()
        except Exception:
            return
