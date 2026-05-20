# tests/test_delpi_notification_client.py
from __future__ import annotations

import json
import os
from io import BytesIO
from unittest.mock import patch

from app.infrastructure.integrations.delpi_notification_client import DelpiNotificationClient


def _configure_env(monkeypatch):
    monkeypatch.setenv("DELPI_NOTIFICATIONS_ENABLED", "true")
    monkeypatch.setenv("DELPI_CORE_API_URL", "https://delpi.example/core-api")
    monkeypatch.setenv("CORE_API_INTEGRATIONS_SERVICE_TOKEN", "test-token")
    monkeypatch.delenv("DELPI_CORE_API_INTERNAL_URL", raising=False)


class _FakeResponse:
    def __init__(self, status: int, body: dict):
        self.status = status
        self._raw = json.dumps(body).encode("utf-8")

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_dispatch_sends_all_emails_in_one_request(monkeypatch):
    _configure_env(monkeypatch)
    captured: list[bytes] = []

    def fake_urlopen(req, timeout=0):
        captured.append(req.data)
        return _FakeResponse(201, {"createdCount": 3})

    with patch("urllib.request.urlopen", side_effect=fake_urlopen):
        client = DelpiNotificationClient()
        client.dispatch(
            emails=["a@x.com", "b@x.com", "c@x.com"],
            title="T",
            message="M",
            deep_path="/conversations/1",
            event="message:new",
            dedupe_key="cmp:msg:1",
        )

    assert len(captured) == 1
    body = json.loads(captured[0].decode("utf-8"))
    assert sorted(body["emails"]) == ["a@x.com", "b@x.com", "c@x.com"]
    assert body["metadata"]["dedupeKey"] == "cmp:msg:1"


def test_dispatch_chunks_large_recipient_lists(monkeypatch):
    _configure_env(monkeypatch)
    monkeypatch.setenv("DELPI_NOTIFICATIONS_BATCH_SIZE", "2")
    calls = 0

    def fake_urlopen(req, timeout=0):
        nonlocal calls
        calls += 1
        payload = json.loads(req.data.decode("utf-8"))
        return _FakeResponse(201, {"createdCount": len(payload["emails"])})

    emails = [f"user{i}@x.com" for i in range(5)]

    with patch("urllib.request.urlopen", side_effect=fake_urlopen):
        client = DelpiNotificationClient()
        client.dispatch(
            emails=emails,
            title="T",
            message="M",
            deep_path="/conversations/1",
            event="message:new",
            dedupe_key="cmp:msg:2",
        )

    assert calls == 3
