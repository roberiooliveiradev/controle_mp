# app/infrastructure/integrations/delpi_directory_client.py
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

from app.core.exceptions import AppError

logger = logging.getLogger(__name__)

DEFAULT_APP_ID = "controle-mp"
DEFAULT_PAGE_SIZE = 200
MAX_PAGES = 50
REQUEST_TIMEOUT_SECONDS = 15


class DelpiDirectoryClient:
    """Cliente S2S para GET /integrations/directory/users/by-app da Core API."""

    def __init__(self) -> None:
        internal = (os.getenv("DELPI_CORE_API_INTERNAL_URL") or "").strip().rstrip("/")
        public = (os.getenv("DELPI_CORE_API_URL") or "").strip().rstrip("/")
        self._api_bases = [base for base in (internal, public) if base]
        self._token = (os.getenv("CORE_API_INTEGRATIONS_SERVICE_TOKEN") or "").strip()
        app_id = (os.getenv("DELPI_DIRECTORY_APP_ID") or DEFAULT_APP_ID).strip()
        self._app_id = app_id or DEFAULT_APP_ID

    def is_configured(self) -> bool:
        return bool(self._api_bases and self._token)

    def list_subjects_by_email(self) -> dict[str, str]:
        if not self.is_configured():
            raise AppError(
                "Integração com a Minha DELPI não configurada.",
                status_code=503,
            )

        collected = self._list_directory_users()
        by_email: dict[str, str] = {}
        for item in collected:
            email = (item.get("email") or "").strip().lower()
            subject = str(item.get("id") or "").strip()
            if not email or "@" not in email or not subject:
                continue
            previous = by_email.get(email)
            if previous and previous != subject:
                logger.warning(
                    "DELPI directory: e-mail %s associado a mais de um id (%s, %s); mantendo o primeiro",
                    email,
                    previous,
                    subject,
                )
                continue
            by_email[email] = subject
        return by_email

    def _list_directory_users(self) -> list[dict[str, str]]:
        last_error: str | None = None
        for base in self._api_bases:
            try:
                return self._paginate(base)
            except AppError as exc:
                last_error = str(exc)
                logger.warning(
                    "DELPI directory failed via %s: %s",
                    base,
                    exc,
                )

        raise AppError(
            last_error or "Falha ao consultar o diretório da Minha DELPI.",
            status_code=503,
        )

    def _paginate(self, base: str) -> list[dict[str, str]]:
        collected: list[dict[str, str]] = []
        page = 1
        while page <= MAX_PAGES:
            payload = self._get_page(base, page)
            items = payload.get("items")
            if not isinstance(items, list):
                raise AppError(
                    "Resposta inválida do diretório da Minha DELPI.",
                    status_code=503,
                )
            for item in items:
                if isinstance(item, dict):
                    collected.append(item)
            has_more = bool(payload.get("hasMore") or payload.get("has_more"))
            if not has_more or not items:
                break
            page += 1
        return collected

    def _get_page(self, base: str, page: int) -> dict:
        query = urllib.parse.urlencode(
            {
                "app": self._app_id,
                "page": page,
                "pageSize": DEFAULT_PAGE_SIZE,
            }
        )
        url = f"{base}/integrations/directory/users/by-app?{query}"
        headers = {
            "Accept": "application/json",
            "User-Agent": "ControleMP-Directory/1.0",
            "Authorization": f"Bearer {self._token}",
            "X-Delpi-Service-Token": self._token,
        }

        last_error: str | None = None
        for attempt in range(2):
            req = urllib.request.Request(url, method="GET", headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
                    raw = resp.read().decode("utf-8", errors="replace")
                    if resp.status >= 500:
                        last_error = f"HTTP {resp.status}"
                        continue
                    if resp.status >= 400:
                        raise AppError(
                            f"Diretório da Minha DELPI recusou a consulta (HTTP {resp.status}).",
                            status_code=503,
                        )
                    try:
                        payload = json.loads(raw) if raw else {}
                    except json.JSONDecodeError as exc:
                        raise AppError(
                            "Resposta inválida do diretório da Minha DELPI.",
                            status_code=503,
                        ) from exc
                    if not isinstance(payload, dict):
                        raise AppError(
                            "Resposta inválida do diretório da Minha DELPI.",
                            status_code=503,
                        )
                    return payload
            except AppError:
                raise
            except urllib.error.HTTPError as exc:
                last_error = f"HTTP {exc.code}"
                if exc.code < 500:
                    raise AppError(
                        f"Diretório da Minha DELPI recusou a consulta (HTTP {exc.code}).",
                        status_code=503,
                    ) from exc
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "DELPI directory GET attempt %s failed via %s page=%s: %s",
                    attempt + 1,
                    url,
                    page,
                    exc,
                )

        raise AppError(
            last_error or "Falha ao consultar o diretório da Minha DELPI.",
            status_code=503,
        )
