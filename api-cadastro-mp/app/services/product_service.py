# app/services/product_service.py
from sqlalchemy.orm import Session
from enum import IntEnum
from datetime import datetime, timezone

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.infrastructure.database.models.product_model import ProductModel
from app.infrastructure.database.models.product_field_model import ProductFieldModel
from app.infrastructure.database.models.request_item_model import RequestItemModel
from app.infrastructure.database.models.request_item_field_model import RequestItemFieldModel

from app.repositories.product_repository import ProductRepository
from app.repositories.product_field_repository import ProductFieldRepository
from app.repositories.request_item_repository import RequestItemRepository

from app.core.interfaces.product_notifier import (
    ProductNotifier,
    ProductCreatedEvent,
    ProductUpdatedEvent,
    ProductFlagChangedEvent,
)


class Role(IntEnum):
    ADMIN = 1
    ANALYST = 2
    USER = 3


class ProductService:
    def __init__(
        self,
        *,
        product_repo: ProductRepository,
        pfield_repo: ProductFieldRepository,
        item_repo: RequestItemRepository,
        product_notifier: ProductNotifier | None = None,
    ) -> None:
        self._product_repo = product_repo
        self._pfield_repo = pfield_repo
        self._item_repo = item_repo
        self._product_notifier = product_notifier

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _get_field_value(self, fields: list[RequestItemFieldModel], tag: str) -> str:
        for f in fields:
            if str(f.field_tag) == str(tag) and (f.field_value or "").strip():
                return str(f.field_value).strip()
        return ""

    def _upsert_product_field(
        self,
        *,
        product_id: int,
        field_type_id: int,
        tag: str,
        value: str | None,
        flag: str | None,
    ) -> None:
        existing = self._pfield_repo.get_by_product_and_tag(product_id, tag)
        if existing is None:
            self._pfield_repo.add_many(
                [
                    ProductFieldModel(
                        product_id=product_id,
                        field_type_id=int(field_type_id),
                        field_tag=str(tag),
                        field_value=value,
                        field_flag=flag,
                    )
                ]
            )
            return

        self._pfield_repo.update_field(
            int(existing.id),
            {"field_type_id": int(field_type_id),
             "field_value": value, "field_flag": flag},
        )

    def apply_request_item_finalized(
        self,
        *,
        item: RequestItemModel,
        item_fields: list[RequestItemFieldModel],
        applied_by: int,
    ) -> int:
        """
        Aplica o snapshot de RequestItemFields no Produto.
        Retorna product_id.
        """

        request_type_id = int(item.request_type_id)

        codigo_atual = self._get_field_value(item_fields, "codigo_atual")
        novo_codigo = self._get_field_value(item_fields, "novo_codigo")

        if request_type_id == 1:  # CREATE
            if not novo_codigo:
                raise ConflictError(
                    "Para finalizar CREATE, o campo 'novo_codigo' é obrigatório.")
            effective_code = novo_codigo
            lookup_code = novo_codigo

        elif request_type_id == 2:  # UPDATE
            if not codigo_atual:
                raise ConflictError(
                    "Para finalizar UPDATE, informe 'codigo_atual'.")
            lookup_code = codigo_atual
            effective_code = novo_codigo if novo_codigo else codigo_atual

        else:
            raise ConflictError("Tipo de solicitação inválido.")

        existing_product_id = self._pfield_repo.find_product_id_by_codigo_atual(
            codigo_atual=lookup_code)

        created = existing_product_id is None
        if created:
            p = self._product_repo.add(ProductModel())
            product_id = int(p.id)
        else:
            product_id = int(existing_product_id)

        codigo_field_type_id: int | None = None
        codigo_field_flag: str | None = None

        for f in item_fields:
            tag = str(f.field_tag)

            if tag == "codigo_atual":
                codigo_field_type_id = int(f.field_type_id)
                codigo_field_flag = f.field_flag
                continue

            if tag == "novo_codigo":
                if codigo_field_type_id is None:
                    codigo_field_type_id = int(f.field_type_id)
                    codigo_field_flag = f.field_flag
                continue

            self._upsert_product_field(
                product_id=product_id,
                field_type_id=int(f.field_type_id),
                tag=tag,
                value=f.field_value,
                flag=f.field_flag,
            )

        if codigo_field_type_id is None:
            raise ConflictError(
                "Não foi possível determinar o tipo do campo para 'codigo_atual'.")

        self._upsert_product_field(
            product_id=product_id,
            field_type_id=int(codigo_field_type_id),
            tag="codigo_atual",
            value=effective_code,
            flag=codigo_field_flag,
        )

        self._product_repo.touch_updated_at(product_id)
        self._item_repo.update_fields(int(item.id), {"product_id": product_id})

        descricao = self._get_field_value(item_fields, "descricao") or None

        # 🔔 Notificação realtime (criado/atualizado)
        if self._product_notifier:
            now_iso = self._now_iso()
            if created:
                self._product_notifier.notify_product_created(
                    ProductCreatedEvent(
                        product_id=product_id,
                        created_by=int(applied_by),
                        created_at_iso=now_iso,
                        codigo_atual=effective_code or None,
                        descricao=descricao,
                    )
                )
            else:
                self._product_notifier.notify_product_updated(
                    ProductUpdatedEvent(
                        product_id=product_id,
                        updated_by=int(applied_by),
                        updated_at_iso=now_iso,
                        codigo_atual=effective_code or None,
                        descricao=descricao,
                    )
                )

        # ✅ agora retorna um “evento” p/ auditoria na rota
        return {
            "product_id": int(product_id),
            "created": bool(created),
            "codigo_atual": effective_code or None,
            "descricao": descricao,
            "lookup_code": lookup_code or None,
        }

    def set_product_field_flag(
        self,
        *,
        field_id: int,
        role_id: int,
        changed_by: int,
        field_flag: str | None,
    ) -> None:
        if role_id not in (Role.ADMIN, Role.ANALYST):
            raise ForbiddenError(
                "Apenas ANALYST/ADMIN podem adicionar/remover flag em produtos.")

        pf = self._pfield_repo.get_by_id(int(field_id))
        if pf is None:
            raise NotFoundError("Campo do produto não encontrado.")

        ok = self._pfield_repo.update_field(
            int(field_id), {"field_flag": field_flag})
        if not ok:
            raise NotFoundError("Campo do produto não encontrado.")

        self._product_repo.touch_updated_at(int(pf.product_id))

        # 🔔 Notificação realtime (flag)
        if self._product_notifier:
            self._product_notifier.notify_product_flag_changed(
                ProductFlagChangedEvent(
                    product_id=int(pf.product_id),
                    field_id=int(pf.id),
                    field_tag=str(pf.field_tag),
                    field_flag=field_flag,
                    changed_by=int(changed_by),
                    changed_at_iso=self._now_iso(),
                )
            )
