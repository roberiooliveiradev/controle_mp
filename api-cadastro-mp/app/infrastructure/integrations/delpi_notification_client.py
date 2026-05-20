# app/infrastructure/integrations/delpi_notification_client.py
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Iterable

logger = logging.getLogger(__name__)

_CONFIG_LOGGED = False
DEFAULT_BATCH_SIZE = 100


def _chunked(items: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


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
            os.getenv("DELPI_PORTAL_CONTROLE_MP_ROUTE", "/controle-mp").strip()
            or "/controle-mp"
        )
        if self._portal_route == "/controle_mp":
            self._portal_route = "/controle-mp"
        if not self._portal_route.startswith("/"):
            self._portal_route = f"/{self._portal_route}"

        raw_batch = (os.getenv("DELPI_NOTIFICATIONS_BATCH_SIZE") or "").strip()
        try:
            self._batch_size = max(1, min(int(raw_batch), 500)) if raw_batch else DEFAULT_BATCH_SIZE
        except ValueError:
            self._batch_size = DEFAULT_BATCH_SIZE

        if not _CONFIG_LOGGED:
            if self.is_configured():
                logger.info(
                    "DELPI notifications enabled → %s (portal_route=%s, batch_size=%s)",
                    self._api_bases,
                    self._portal_route,
                    self._batch_size,
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

        total_created = 0
        for chunk in _chunked(unique_emails, self._batch_size):
            created = self._dispatch_batch(
                emails=chunk,
                title=title,
                message=message,
                notification_type=notification_type,
                deep_path=deep_path,
                event=event,
                dedupe_key=dedupe_key,
                action_label=action_label,
                metadata_extra=metadata_extra,
            )
            total_created += created

        if total_created:
            logger.info(
                "DELPI notification sent (%s): %s/%s recipients (batch)",
                event,
                total_created,
                len(unique_emails),
            )
        elif len(unique_emails):
            logger.warning(
                "DELPI notification: nenhuma notificação criada (%s) para %s destinatário(s)",
                event,
                len(unique_emails),
            )

    def _dispatch_batch(
        self,
        *,
        emails: list[str],
        title: str,
        message: str,
        notification_type: str,
        deep_path: str,
        event: str,
        dedupe_key: str,
        action_label: str,
        metadata_extra: dict | None,
    ) -> int:
        if not emails:
            return 0

        result = self._post_dispatch(
            emails=emails,
            title=title,
            message=message,
            notification_type=notification_type,
            deep_path=deep_path,
            event=event,
            dedupe_key=dedupe_key,
            action_label=action_label,
            metadata_extra=metadata_extra,
        )

        if result is not None:
            return result

        if len(emails) <= 1:
            return 0

        logger.warning(
            "DELPI batch failed (%s); tentando envio individual para %s destinatário(s)",
            event,
            len(emails),
        )
        created = 0
        for email in emails:
            one = self._post_dispatch(
                emails=[email],
                title=title,
                message=message,
                notification_type=notification_type,
                deep_path=deep_path,
                event=event,
                dedupe_key=f"{dedupe_key}:{email}",
                action_label=action_label,
                metadata_extra=metadata_extra,
            )
            if one:
                created += one
        return created

    def _post_dispatch(
        self,
        *,
        emails: list[str],
        title: str,
        message: str,
        notification_type: str,
        deep_path: str,
        event: str,
        dedupe_key: str,
        action_label: str,
        metadata_extra: dict | None,
    ) -> int | None:
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
            "emails": emails,
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
        label = emails[0] if len(emails) == 1 else f"batch:{len(emails)}"

        for dispatch_url in self._dispatch_urls():
            req = urllib.request.Request(
                dispatch_url,
                data=data,
                method="POST",
                headers=headers,
            )

            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
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
                            "via %s. Verifique e-mails na Minha DELPI, permissão controle-mp "
                            "e categoria controle_mp nas preferências.",
                            label,
                            event,
                            dispatch_url,
                        )
                        return 0
                    if created < len(emails):
                        logger.info(
                            "DELPI batch parcial (%s): %s/%s criadas via %s",
                            event,
                            created,
                            len(emails),
                            dispatch_url,
                        )
                    return created
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")[:500]
                last_error = f"HTTP {exc.code}: {detail}"
                if exc.code == 400 and "user not found" in detail.lower():
                    if len(emails) == 1:
                        logger.warning(
                            "DELPI: e-mail %s não encontrado na Minha DELPI (%s)",
                            emails[0],
                            event,
                        )
                        return 0
                    return None
                logger.warning(
                    "DELPI notification HTTP %s for %s (%s) via %s: %s",
                    exc.code,
                    label,
                    event,
                    dispatch_url,
                    detail,
                )
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "DELPI notification failed for %s (%s) via %s: %s",
                    label,
                    event,
                    dispatch_url,
                    exc,
                )

        if last_error:
            logger.error(
                "DELPI notification exhausted URLs for %s (%s): %s",
                label,
                event,
                last_error,
            )
        return None
