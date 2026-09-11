# tests/test_request_field_edit_permissions.py
from __future__ import annotations

import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_NAME", "controle_mp_test")
os.environ.setdefault("DB_USER", "controle_mp")
os.environ.setdefault("DB_PASSWORD", "test")

from app.core.exceptions import ConflictError, ForbiddenError
from app.services.request_service import (
    RequestService,
    RequestStatus,
    RequestType,
    Role,
)

OWNER_ID = 10
OTHER_USER_ID = 99
CORRECTION_TAGS = (
    "descricao",
    "grupo",
    "fornecedores",
    "unidade",
    "cta_contabil",
    "codigo_atual",
    "novo_codigo",
)


def _service() -> RequestService:
    return RequestService(
        conv_repo=MagicMock(),
        msg_repo=MagicMock(),
        req_repo=MagicMock(),
        item_repo=MagicMock(),
        field_repo=MagicMock(),
        status_repo=MagicMock(),
        type_repo=MagicMock(),
        product_repo=MagicMock(),
        pfield_repo=MagicMock(),
        totvs_repo=MagicMock(),
        notifier=None,
    )


def _req(*, created_by: int = OWNER_ID) -> SimpleNamespace:
    return SimpleNamespace(id=568, created_by=created_by, message_id=829)


def _item(*, type_id: int, status_id: int, item_id: int = 843) -> SimpleNamespace:
    return SimpleNamespace(
        id=item_id,
        request_id=568,
        request_type_id=type_id,
        request_status_id=status_id,
    )


class RequestFieldEditPermissionsTest(unittest.TestCase):
    def test_p0_update_returned_owner_can_edit_correction_fields(self):
        svc = _service()
        req = _req()
        item = _item(type_id=RequestType.UPDATE, status_id=RequestStatus.RETURNED)

        for tag in CORRECTION_TAGS:
            svc._ensure_user_can_edit_field(
                req=req,
                item=item,
                user_id=OWNER_ID,
                role_id=Role.USER,
                field_tag=tag,
            )

    def test_sibling_create_returned_owner_can_edit_non_code_fields(self):
        svc = _service()
        req = _req()
        item = _item(type_id=RequestType.CREATE, status_id=RequestStatus.RETURNED)

        svc._ensure_user_can_edit_field(
            req=req,
            item=item,
            user_id=OWNER_ID,
            role_id=Role.USER,
            field_tag="descricao",
        )
        svc._ensure_user_can_edit_field(
            req=req,
            item=item,
            user_id=OWNER_ID,
            role_id=Role.USER,
            field_tag="fornecedores",
        )

    def test_sibling_create_returned_owner_cannot_edit_novo_codigo(self):
        svc = _service()
        with self.assertRaises(ForbiddenError) as ctx:
            svc._ensure_user_can_edit_field(
                req=_req(),
                item=_item(type_id=RequestType.CREATE, status_id=RequestStatus.RETURNED),
                user_id=OWNER_ID,
                role_id=Role.USER,
                field_tag="novo_codigo",
            )
        self.assertIn("novo_codigo", str(ctx.exception))

    def test_negative_update_in_progress_cannot_edit_even_as_owner(self):
        svc = _service()
        with self.assertRaises(ForbiddenError) as ctx:
            svc._ensure_user_can_edit_field(
                req=_req(),
                item=_item(
                    type_id=RequestType.UPDATE,
                    status_id=RequestStatus.IN_PROGRESS,
                ),
                user_id=OWNER_ID,
                role_id=Role.USER,
                field_tag="descricao",
            )
        message = str(ctx.exception)
        self.assertIn("DEVOLVIDO", message)
        self.assertNotIn("RETURNED", message)

    def test_negative_update_returned_non_owner_cannot_edit(self):
        svc = _service()
        with self.assertRaises(ForbiddenError) as ctx:
            svc._ensure_user_can_edit_field(
                req=_req(created_by=OWNER_ID),
                item=_item(type_id=RequestType.UPDATE, status_id=RequestStatus.RETURNED),
                user_id=OTHER_USER_ID,
                role_id=Role.USER,
                field_tag="descricao",
            )
        self.assertIn("criador", str(ctx.exception).lower())

    def test_negative_finalized_item_remains_locked(self):
        svc = _service()
        with self.assertRaises(ConflictError) as ctx:
            svc._ensure_user_can_edit_field(
                req=_req(),
                item=_item(
                    type_id=RequestType.UPDATE,
                    status_id=RequestStatus.FINALIZED,
                ),
                user_id=OWNER_ID,
                role_id=Role.USER,
                field_tag="descricao",
            )
        self.assertIn("FINALIZED", str(ctx.exception))

    def test_negative_rejected_item_remains_locked(self):
        svc = _service()
        with self.assertRaises(ConflictError):
            svc._ensure_user_can_edit_field(
                req=_req(),
                item=_item(
                    type_id=RequestType.UPDATE,
                    status_id=RequestStatus.REJECTED,
                ),
                user_id=OWNER_ID,
                role_id=Role.USER,
                field_tag="descricao",
            )

    def test_wiring_update_field_persists_descricao_on_returned_update_item(self):
        svc = _service()
        field = SimpleNamespace(id=91, request_items_id=843, field_tag="descricao")
        item = _item(type_id=RequestType.UPDATE, status_id=RequestStatus.RETURNED)
        req = _req()
        conv = SimpleNamespace(created_by=OWNER_ID)

        svc._field_repo.get_by_id.return_value = field
        svc._item_repo.get_by_id.return_value = item
        svc._req_repo.get_by_id.return_value = req
        svc._msg_repo.get_row.return_value = (
            SimpleNamespace(conversation_id=149),
            None,
        )
        svc._conv_repo.get_row_by_id.return_value = (conv, None, None)
        svc._field_repo.update_fields.return_value = True

        svc.update_field(
            field_id=91,
            user_id=OWNER_ID,
            role_id=Role.USER,
            values={"field_value": "TERM. PINO FEMEA CORRIGIDO"},
        )

        svc._field_repo.update_fields.assert_called_once_with(
            91, {"field_value": "TERM. PINO FEMEA CORRIGIDO"}
        )
        svc._item_repo.touch_updated_at.assert_called_once_with(843)


if __name__ == "__main__":
    unittest.main()
