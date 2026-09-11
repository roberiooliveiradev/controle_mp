# tests/test_central_subject_binding.py
from __future__ import annotations

import unittest

from app.services.central_subject_binding import (
    OUTCOME_CONFLICT,
    OUTCOME_NOT_FOUND,
    OUTCOME_UNCHANGED,
    OUTCOME_UPDATED,
    decide_central_subject_bind,
)

SUBJECT_A = "11111111-1111-1111-1111-111111111111"
SUBJECT_B = "22222222-2222-2222-2222-222222222222"


class CentralSubjectBindingTest(unittest.TestCase):
    def test_p0_binds_when_user_has_no_subject(self):
        decision = decide_central_subject_bind(
            user_id=42,
            current_subject=None,
            directory_subject=SUBJECT_A,
            occupied_by_other_user_id=None,
        )
        self.assertEqual(decision.outcome, OUTCOME_UPDATED)
        self.assertEqual(decision.subject, SUBJECT_A)

    def test_sibling_keeps_existing_subject_when_directory_matches(self):
        decision = decide_central_subject_bind(
            user_id=42,
            current_subject=SUBJECT_A,
            directory_subject=SUBJECT_A,
            occupied_by_other_user_id=42,
        )
        self.assertEqual(decision.outcome, OUTCOME_UNCHANGED)
        self.assertEqual(decision.subject, SUBJECT_A)

    def test_sibling_keeps_existing_subject_when_email_not_in_directory(self):
        decision = decide_central_subject_bind(
            user_id=42,
            current_subject=SUBJECT_A,
            directory_subject=None,
            occupied_by_other_user_id=None,
        )
        self.assertEqual(decision.outcome, OUTCOME_UNCHANGED)
        self.assertEqual(decision.subject, SUBJECT_A)

    def test_negative_missing_directory_user_is_not_found(self):
        decision = decide_central_subject_bind(
            user_id=42,
            current_subject=None,
            directory_subject=None,
            occupied_by_other_user_id=None,
        )
        self.assertEqual(decision.outcome, OUTCOME_NOT_FOUND)

    def test_negative_subject_occupied_by_another_user(self):
        decision = decide_central_subject_bind(
            user_id=42,
            current_subject=None,
            directory_subject=SUBJECT_A,
            occupied_by_other_user_id=7,
        )
        self.assertEqual(decision.outcome, OUTCOME_CONFLICT)
        self.assertIn("outro usuário", decision.reason or "")

    def test_negative_does_not_overwrite_different_subject(self):
        decision = decide_central_subject_bind(
            user_id=42,
            current_subject=SUBJECT_A,
            directory_subject=SUBJECT_B,
            occupied_by_other_user_id=None,
        )
        self.assertEqual(decision.outcome, OUTCOME_CONFLICT)
        self.assertEqual(decision.subject, SUBJECT_A)


if __name__ == "__main__":
    unittest.main()
