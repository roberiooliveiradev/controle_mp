# tests/test_central_subject_sync.py
from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.core.exceptions import AppError
from app.infrastructure.integrations.delpi_directory_client import DelpiDirectoryClient
from app.services.user_service import UserService

SUBJECT_A = "11111111-1111-1111-1111-111111111111"
SUBJECT_B = "22222222-2222-2222-2222-222222222222"


def _user(**overrides) -> SimpleNamespace:
    data = dict(
        id=10,
        full_name="Ada Lovelace",
        email="ada@delpi.com.br",
        central_subject=None,
        updated_at=None,
    )
    data.update(overrides)
    return SimpleNamespace(**data)


class CentralSubjectSyncServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = MagicMock()
        self.svc = UserService(self.repo)

    def test_p0_binds_unlinked_user_from_directory_email(self):
        user = _user()
        self.repo.list_all_unpaged.return_value = [user]
        self.repo.get_by_central_subject.return_value = None

        result = self.svc.sync_central_subjects_from_directory(
            {"ada@delpi.com.br": SUBJECT_A}
        )

        self.assertEqual(user.central_subject, SUBJECT_A)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["not_found"], 0)
        self.assertEqual(result["directory_count"], 1)

    def test_sibling_leaves_already_bound_user_unchanged(self):
        user = _user(central_subject=SUBJECT_A)
        self.repo.list_all_unpaged.return_value = [user]
        self.repo.get_by_central_subject.return_value = user

        result = self.svc.sync_central_subjects_from_directory(
            {"ada@delpi.com.br": SUBJECT_A}
        )

        self.assertEqual(result["updated"], 0)
        self.assertEqual(result["unchanged"], 1)

    def test_negative_local_only_email_is_not_found(self):
        user = _user(email="admin@local.com")
        self.repo.list_all_unpaged.return_value = [user]

        result = self.svc.sync_central_subjects_from_directory({})

        self.assertIsNone(user.central_subject)
        self.assertEqual(result["not_found"], 1)
        self.assertEqual(result["updated"], 0)

    def test_negative_conflict_when_subject_belongs_to_another_user(self):
        user = _user()
        other = _user(id=7, email="other@delpi.com.br", central_subject=SUBJECT_A)
        self.repo.list_all_unpaged.return_value = [user]
        self.repo.get_by_central_subject.return_value = other

        result = self.svc.sync_central_subjects_from_directory(
            {"ada@delpi.com.br": SUBJECT_A}
        )

        self.assertIsNone(user.central_subject)
        self.assertEqual(len(result["conflicts"]), 1)
        self.assertEqual(result["conflicts"][0]["user_id"], 10)


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


class DelpiDirectoryClientTest(unittest.TestCase):
    def test_negative_not_configured(self):
        with patch.dict("os.environ", {}, clear=True):
            client = DelpiDirectoryClient()
            with self.assertRaises(AppError) as ctx:
                client.list_subjects_by_email()
            self.assertEqual(ctx.exception.status_code, 503)

    def test_p0_maps_email_to_subject_across_pages(self):
        pages = [
            {
                "items": [{"id": SUBJECT_A, "email": "ada@delpi.com.br", "name": "Ada"}],
                "hasMore": True,
            },
            {
                "items": [{"id": SUBJECT_B, "email": "bob@delpi.com.br", "name": "Bob"}],
                "hasMore": False,
            },
        ]
        calls = {"n": 0}

        def fake_urlopen(req, timeout=0):
            payload = pages[calls["n"]]
            calls["n"] += 1
            return _FakeResponse(200, payload)

        env = {
            "DELPI_CORE_API_URL": "https://delpi.example/core-api",
            "CORE_API_INTEGRATIONS_SERVICE_TOKEN": "token",
        }
        with patch.dict("os.environ", env, clear=True):
            with patch("urllib.request.urlopen", side_effect=fake_urlopen):
                mapped = DelpiDirectoryClient().list_subjects_by_email()

        self.assertEqual(mapped["ada@delpi.com.br"], SUBJECT_A)
        self.assertEqual(mapped["bob@delpi.com.br"], SUBJECT_B)
        self.assertEqual(calls["n"], 2)


if __name__ == "__main__":
    unittest.main()
