# tests/test_sso_central_subject.py
from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.core.exceptions import ConflictError, UnauthorizedError
from app.services.user_service import UserService

SUBJECT_A = "11111111-1111-1111-1111-111111111111"
SUBJECT_B = "22222222-2222-2222-2222-222222222222"


def _user(**overrides) -> SimpleNamespace:
    data = dict(
        id=10,
        full_name="Ada Lovelace",
        email="ada@delpi.com.br",
        central_subject=None,
        role_id=3,
        last_login=None,
        updated_at=None,
    )
    data.update(overrides)
    return SimpleNamespace(**data)


class SsoCentralSubjectTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = MagicMock()
        self.svc = UserService(self.repo)

    def test_p0_creates_user_with_central_subject(self):
        self.repo.get_by_central_subject.return_value = None
        self.repo.get_by_email.return_value = None
        created = _user(id=1, central_subject=SUBJECT_A)
        self.repo.add.return_value = created

        with patch(
            "app.services.user_service.PasswordHasher.hash_password",
            return_value=("hash", "salt", "pbkdf2_sha256", 1),
        ):
            user = self.svc.get_or_create_from_sso(
                full_name="Ada Lovelace",
                email="ada@delpi.com.br",
                central_subject=SUBJECT_A,
            )

        self.assertEqual(user.central_subject, SUBJECT_A)
        added = self.repo.add.call_args.args[0]
        self.assertEqual(added.central_subject, SUBJECT_A)
        self.assertEqual(added.email, "ada@delpi.com.br")

    def test_sibling_binds_existing_email_user(self):
        existing = _user(central_subject=None)
        self.repo.get_by_central_subject.return_value = None
        self.repo.get_by_email.return_value = existing

        user = self.svc.get_or_create_from_sso(
            full_name="Ada Lovelace",
            email="ada@delpi.com.br",
            central_subject=SUBJECT_A,
        )

        self.assertIs(user, existing)
        self.assertEqual(user.central_subject, SUBJECT_A)
        self.repo.add.assert_not_called()

    def test_sibling_finds_by_central_subject_even_if_email_changed(self):
        existing = _user(email="old@delpi.com.br", central_subject=SUBJECT_A)
        self.repo.get_by_central_subject.return_value = existing
        self.repo.get_by_email.return_value = None

        user = self.svc.get_or_create_from_sso(
            full_name="Ada Lovelace",
            email="ada@delpi.com.br",
            central_subject=SUBJECT_A,
        )

        self.assertIs(user, existing)
        self.assertEqual(user.email, "ada@delpi.com.br")
        self.repo.add.assert_not_called()

    def test_negative_email_already_bound_to_another_subject(self):
        existing = _user(central_subject=SUBJECT_B)
        self.repo.get_by_central_subject.return_value = None
        self.repo.get_by_email.return_value = existing

        with self.assertRaises(ConflictError) as ctx:
            self.svc.get_or_create_from_sso(
                full_name="Ada Lovelace",
                email="ada@delpi.com.br",
                central_subject=SUBJECT_A,
            )

        self.assertIn("Minha DELPI", str(ctx.exception))
        self.repo.add.assert_not_called()

    def test_negative_blank_central_subject_is_rejected(self):
        with self.assertRaises(UnauthorizedError):
            self.svc.get_or_create_from_sso(
                full_name="Ada",
                email="ada@delpi.com.br",
                central_subject="  ",
            )


if __name__ == "__main__":
    unittest.main()
