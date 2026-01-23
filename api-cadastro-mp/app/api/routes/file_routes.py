# app/api/routes/file_routes.py
from __future__ import annotations

from flask import Blueprint, jsonify, request, send_file, g
from werkzeug.datastructures import FileStorage as WzFileStorage

from app.api.middlewares.auth_middleware import require_auth
from app.api.schemas.file_schema import UploadFilesResponse, UploadFileResponse
from app.config.settings import settings
from app.core.exceptions import ConflictError, NotFoundError

from app.infrastructure.storage.local_file_storage import LocalFileStorage, LocalFileStorageConfig
from app.infrastructure.database.session import db_session
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_file_repository import MessageFileRepository
from app.services.file_service import FileService


bp_files = Blueprint(
    "files",
    __name__,
)


def _auth_user():
    auth = getattr(g, "auth", None)
    return int(auth["sub"]), int(auth["role_id"])


def _get_upload_files() -> list[WzFileStorage]:
    files = request.files.getlist("files")
    if files:
        return files
    one = request.files.get("file")
    return [one] if one else []


def _allowed_mime_types() -> set[str]:
    raw = (settings.allowed_mime_types_raw or "").strip()
    if not raw:
        return set()
    parts = [p.strip() for p in raw.split(",")]
    return {p for p in parts if p}


def _validate_mime(mimetype: str | None) -> None:
    allowed = _allowed_mime_types()
    if not allowed:
        return  # whitelist desativada

    if not mimetype:
        raise ConflictError("Tipo do arquivo (MIME) ausente. Upload bloqueado pela whitelist.")

    if mimetype not in allowed:
        raise ConflictError(f"Tipo de arquivo não permitido: '{mimetype}'.")


@bp_files.post("/upload")
@require_auth
def upload_files():
    files = _get_upload_files()
    if not files:
        raise ConflictError("Nenhum arquivo enviado. Use multipart/form-data com 'files' ou 'file'.")

    max_bytes = max(1, settings.max_file_size_mb) * 1024 * 1024
    storage = LocalFileStorage(config=LocalFileStorageConfig(base_path=settings.files_base_path))

    out: list[UploadFileResponse] = []
    saved_stored_names: list[str] = []

    try:
        for f in files:
            if f is None:
                continue

            if f.filename is None or not str(f.filename).strip():
                raise ConflictError("Arquivo inválido: filename ausente.")

            _validate_mime(f.mimetype)

            stored = storage.save(
                fileobj=f.stream,
                original_name=f.filename,
                content_type=f.mimetype,
            )
            saved_stored_names.append(stored.stored_name)

            # ✅ Hard limit + rollback real (arquivo acabou de ser salvo)
            if stored.size_bytes > max_bytes:
                storage.delete(stored_name=stored.stored_name)
                raise ConflictError(
                    f"Arquivo '{stored.original_name}' excede o limite de {settings.max_file_size_mb}MB."
                )

            out.append(
                UploadFileResponse(
                    original_name=stored.original_name,
                    stored_name=stored.stored_name,
                    content_type=stored.content_type,
                    size_bytes=stored.size_bytes,
                    sha256=stored.sha256,
                )
            )

    except Exception:
        # rollback best-effort do que já foi salvo nesta requisição
        for stored_name in saved_stored_names:
            storage.delete(stored_name=stored_name)
        raise

    payload = UploadFilesResponse(files=out).model_dump()
    return jsonify(payload), 201


@bp_files.get("/<int:file_id>/download")
@require_auth
def download_file(file_id: int):
    user_id, role_id = _auth_user()

    with db_session() as session:
        svc = FileService(
            conv_repo=ConversationRepository(session),
            file_repo=MessageFileRepository(session),
        )
        f = svc.get_file_for_download(file_id=file_id, user_id=user_id, role_id=role_id)

    storage = LocalFileStorage(config=LocalFileStorageConfig(base_path=settings.files_base_path))

    # local_file_storage garante que stored_name resolve dentro da base (anti path traversal)
    try:
        abs_path = storage._abs_path_from_stored(f.stored_name)  # noqa: SLF001 (uso interno controlado)
    except ValueError:
        raise NotFoundError("Arquivo não encontrado.")

    if not abs_path.exists() or not abs_path.is_file():
        raise NotFoundError("Arquivo não encontrado.")

    return send_file(
        abs_path,
        as_attachment=True,
        download_name=f.original_name,
        mimetype=f.content_type or "application/octet-stream",
        conditional=True,
        etag=True,
        last_modified=True,
    )
