# app/services/central_subject_binding.py
from __future__ import annotations

from dataclasses import dataclass

OUTCOME_UPDATED = "updated"
OUTCOME_UNCHANGED = "unchanged"
OUTCOME_NOT_FOUND = "not_found"
OUTCOME_CONFLICT = "conflict"


@dataclass(frozen=True)
class BindDecision:
    outcome: str
    subject: str | None
    reason: str | None = None


def decide_central_subject_bind(
    *,
    user_id: int,
    current_subject: str | None,
    directory_subject: str | None,
    occupied_by_other_user_id: int | None,
) -> BindDecision:
    current = (current_subject or "").strip() or None
    incoming = (directory_subject or "").strip() or None

    if incoming is None:
        if current:
            return BindDecision(OUTCOME_UNCHANGED, current)
        return BindDecision(OUTCOME_NOT_FOUND, None)

    if (
        occupied_by_other_user_id is not None
        and int(occupied_by_other_user_id) != int(user_id)
    ):
        return BindDecision(
            OUTCOME_CONFLICT,
            current,
            "ID Minha DELPI já vinculado a outro usuário.",
        )

    if current is None:
        return BindDecision(OUTCOME_UPDATED, incoming)

    if current == incoming:
        return BindDecision(OUTCOME_UNCHANGED, current)

    return BindDecision(
        OUTCOME_CONFLICT,
        current,
        "Usuário já vinculado a outro ID da Minha DELPI.",
    )
