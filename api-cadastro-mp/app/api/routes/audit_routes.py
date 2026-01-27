# app/api/routes/audit_routes.py

from __future__ import annotations

from datetime import datetime
from flask import Blueprint, jsonify, request

from app.api.middlewares.auth_middleware import require_auth, require_roles
from app.infrastructure.database.session import db_session
from app.repositories.audit_log_repository import AuditLogRepository
from app.services.audit_report_service import AuditReportService
from app.api.schemas.audit_schema import (
    AuditLogsListResponse,
    AuditLogRowResponse,
    AuditSummaryResponse,
)


bp_audit = Blueprint("audit", __name__, url_prefix="/api/audit")


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


@bp_audit.get("/logs")
@require_auth
@require_roles(1)
def admin_list_audit_logs():
    try:
        limit = max(1, min(int(request.args.get("limit", 50)), 200))
        offset = max(0, int(request.args.get("offset", 0)))
    except ValueError:
        return jsonify({"error": "Parâmetros limit/offset inválidos."}), 400

    entity_name = (request.args.get("entity_name") or "").strip() or None
    action_name = (request.args.get("action_name") or "").strip() or None
    q = (request.args.get("q") or "").strip() or None

    # ✅ novo filtro
    user_name = (request.args.get("user_name") or "").strip() or None

    # (compat opcional)
    user_id_raw = (request.args.get("user_id") or "").strip()
    user_id = int(user_id_raw) if user_id_raw else None

    entity_id_raw = (request.args.get("entity_id") or "").strip()
    entity_id = int(entity_id_raw) if entity_id_raw else None

    occurred_from = _parse_dt((request.args.get("from") or "").strip() or None)
    occurred_to = _parse_dt((request.args.get("to") or "").strip() or None)

    if (request.args.get("from") and occurred_from is None) or (request.args.get("to") and occurred_to is None):
        return jsonify({"error": "Parâmetros from/to inválidos. Use ISO (ex: 2026-01-26T10:30:00)."}), 400

    with db_session() as session:
        svc = AuditReportService(AuditLogRepository(session))
        rows, total = svc.list_logs(
            limit=limit,
            offset=offset,
            entity_name=entity_name,
            action_name=action_name,
            user_name=user_name,   # ✅
            user_id=user_id,       # compat
            entity_id=entity_id,
            q=q,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )

    # ✅ agora rows é lista de dicts
    payload = AuditLogsListResponse(
        items=[
            AuditLogRowResponse(
                id=int(r["id"]),
                entity_name=r["entity_name"],
                entity_id=(int(r["entity_id"]) if r.get(
                    "entity_id") is not None else None),
                action_name=r["action_name"],
                details=r.get("details"),
                occurred_at=r["occurred_at"],
                user_name=r.get("user_name"),
            )
            for r in rows
        ],
        total=int(total),
        limit=limit,
        offset=offset,
    ).model_dump()

    return jsonify(payload), 200


@bp_audit.get("/summary")
@require_auth
@require_roles(1)
def admin_audit_summary():
    entity_name = (request.args.get("entity_name") or "").strip() or None
    action_name = (request.args.get("action_name") or "").strip() or None

    # (mantém compat por enquanto)
    user_id_raw = (request.args.get("user_id") or "").strip()
    user_id = int(user_id_raw) if user_id_raw else None

    occurred_from = _parse_dt((request.args.get("from") or "").strip() or None)
    occurred_to = _parse_dt((request.args.get("to") or "").strip() or None)

    top_users_limit_raw = (request.args.get("top_users_limit") or "").strip()
    top_users_limit = int(top_users_limit_raw) if top_users_limit_raw else 10
    top_users_limit = max(1, min(top_users_limit, 50))

    if (request.args.get("from") and occurred_from is None) or (request.args.get("to") and occurred_to is None):
        return jsonify({"error": "Parâmetros from/to inválidos. Use ISO (ex: 2026-01-26T10:30:00)."}), 400

    with db_session() as session:
        svc = AuditReportService(AuditLogRepository(session))
        summary = svc.summary(
            occurred_from=occurred_from,
            occurred_to=occurred_to,
            entity_name=entity_name,
            action_name=action_name,
            user_id=user_id,
            top_users_limit=top_users_limit,
        )

    return jsonify(AuditSummaryResponse(**summary).model_dump()), 200
