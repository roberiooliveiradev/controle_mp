# app/infrastructure/integrations/delpi_notification_client.py
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

_CONFIG_LOGGED = False


class DelpiNotificationClient:
    """Cliente HTTP para POST /integrations/notifications da Core API DELPI."""

    def __init__(self) -> None:
        global _CONFIG_LOGGED

        self._enabled = os.getenv("DELPI_NOTIFICATIONS_ENABLED", "false").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
        internal = (os.getenv("DELPI_CORE_API_INTERNAL_URL") or "").strip().rstrip("/")
        public = (os.getenv("DELPI_CORE_API_URL") or "").strip().rstrip("/")
        self._api_bases = [b for b in (internal, public) if b]
        self._token = (os.getenv("CORE_API_INTEGRATIONS_SERVICE_TOKEN") or "").strip()
        self._portal_route = (
            os.getenv("DELPI_PORTAL_CONTROLE_MP_ROUTE", "/controle_mp").strip()
            or "/controle_mp"
        )
        if not self._portal_route.startswith("/"):
            self._portal_route = f"/{self._portal_route}"

        if not _CONFIG_LOGGED:
            if self.is_configured():
                logger.info(
                    "DELPI notifications enabled → %s (portal_route=%s)",
                    self._api_bases,
                    self._portal_route,
                )
            else:
                logger.warning(
                    "DELPI notifications disabled or incomplete config "
                    "(DELPI_NOTIFICATIONS_ENABLED, DELPI_CORE_API_URL, "
                    "CORE_API_INTEGRATIONS_SERVICE_TOKEN)"
                )
            _CONFIG_LOGGED = True

    @property
    def portal_route(self) -> str:
        return self._portal_route

    def is_configured(self) -> bool:
        return bool(self._enabled and self._api_bases and self._token)

    def _dispatch_urls(self) -> list[str]:
        return [f"{base}/integrations/notifications" for base in self._api_bases]

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
            logger.debug("DELPI notification skipped (%s): no recipient emails", dedupe_key)
            return

        sent = 0
        for email in unique_emails:
            if self._dispatch_one(
                email=email,
                title=title,
                message=message,
                notification_type=notification_type,
                deep_path=deep_path,
                event=event,
                dedupe_key=f"{dedupe_key}:{email}",
                action_label=action_label,
                metadata_extra=metadata_extra,
            ):
                sent += 1

        if sent:
            logger.info(
                "DELPI notification sent (%s): %s/%s recipients",
                event,
                sent,
                len(unique_emails),
            )

    def _dispatch_one(
        self,
        *,
        email: str,
        title: str,
        message: str,
        notification_type: str,
        deep_path: str,
        event: str,
        dedupe_key: str,
        action_label: str,
        metadata_extra: dict | None,
    ) -> bool:
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
            "emails": [email],
            "sourceApp": "controle_mp",
            "action": {
                "type": "portal_route",
                "label": action_label,
                "target": self._portal_route,
            },
            "metadata": metadata,
        }

        data = json.dumps(body).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "ControleMP-Notifications/1.0",
            "X-Delpi-Service-Token": self._token,
        }

        last_error: str | None = None

        for dispatch_url in self._dispatch_urls():
            req = urllib.request.Request(
                dispatch_url,
                data=data,
                method="POST",
                headers=headers,
            )

            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    raw = resp.read().decode("utf-8", errors="replace")
                    if resp.status >= 400:
                        last_error = f"HTTP {resp.status}: {raw[:300]}"
                        continue
                    try:
                        payload = json.loads(raw) if raw else {}
                    except json.JSONDecodeError:
                        payload = {}
                    created = int(
                        payload.get("createdCount") or payload.get("created_count") or 0
                    )
                    if created < 1:
                        logger.warning(
                            "DELPI notification accepted but createdCount=0 for %s (%s) "
                            "via %s. Verifique e-mail na Minha DELPI e categoria controle_mp "
                            "nas preferências.",
                            email,
                            event,
                            dispatch_url,
                        )
                        return False
                    return True
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")[:500]
                last_error = f"HTTP {exc.code}: {detail}"
                if exc.code == 400 and "user not found" in detail.lower():
                    logger.warning(
                        "DELPI: e-mail %s não encontrado na Minha DELPI (%s) — "
                        "use o mesmo e-mail do Keycloak/SSO no Controle MP",
                        email,
                        event,
                    )
                    return False
                logger.warning(
                    "DELPI notification HTTP %s for %s (%s) via %s: %s",
                    exc.code,
                    email,
                    event,
                    dispatch_url,
                    detail,
                )
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "DELPI notification failed for %s (%s) via %s: %s",
                    email,
                    event,
                    dispatch_url,
                    exc,
                )

        if last_error:
            logger.error(
                "DELPI notification exhausted URLs for %s (%s): %s",
                email,
                event,
                last_error,
            )
        return False
