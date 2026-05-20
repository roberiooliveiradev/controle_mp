# app/infrastructure/integrations/delpi_notification_client.py
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)


class DelpiNotificationClient:
    """Cliente HTTP para POST /integrations/notifications da Core API DELPI."""

    def __init__(self) -> None:
        self._enabled = os.getenv("DELPI_NOTIFICATIONS_ENABLED", "false").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
        base = (os.getenv("DELPI_CORE_API_URL") or "").strip().rstrip("/")
        self._dispatch_url = f"{base}/integrations/notifications" if base else ""
        self._token = (os.getenv("CORE_API_INTEGRATIONS_SERVICE_TOKEN") or "").strip()
        self._portal_route = (
            os.getenv("DELPI_PORTAL_CONTROLE_MP_ROUTE", "/apps/controle-mp").strip()
            or "/apps/controle-mp"
        )
        if not self._portal_route.startswith("/"):
            self._portal_route = f"/{self._portal_route}"

    @property
    def portal_route(self) -> str:
        return self._portal_route

    def is_configured(self) -> bool:
        return bool(self._enabled and self._dispatch_url and self._token)

    def dispatch(
        self,
        *,
        emails: list[str],
        title: str,
        message: str,
        notification_type: str = "info",
        deep_path: str,
        event: str,
        dedupe_key: str,
        action_label: str = "Abrir",
        metadata_extra: dict | None = None,
    ) -> None:
        if not self.is_configured():
            return

        unique_emails = sorted({e.strip().lower() for e in emails if e and "@" in e})
        if not unique_emails:
            return

        normalized_path = deep_path if deep_path.startswith("/") else f"/{deep_path}"

        metadata: dict = {
            "source": "controle_mp",
            "event": event,
            "dedupeKey": dedupe_key,
            "deepPath": normalized_path,
        }
        if metadata_extra:
            metadata.update(metadata_extra)

        body = {
            "title": title,
            "message": message,
            "type": notification_type,
            "category": "controle_mp",
            "presentation": "text",
            "icon": "message-circle",
            "emails": unique_emails,
            "action": {
                "type": "portal_route",
                "label": action_label,
                "target": self._portal_route,
            },
            "metadata": metadata,
        }

        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            self._dispatch_url,
            data=data,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Delpi-Service-Token": self._token,
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status >= 400:
                    logger.warning(
                        "DELPI notification dispatch HTTP %s for %s",
                        resp.status,
                        dedupe_key,
                    )
        except urllib.error.HTTPError as exc:
            logger.warning(
                "DELPI notification HTTP error %s for %s: %s",
                exc.code,
                dedupe_key,
                exc.read()[:500],
            )
        except Exception:
            logger.exception("DELPI notification dispatch failed for %s", dedupe_key)
