# app/services/product_service.py

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.infrastructure.database.models.product_model import ProductModel
from app.infrastructure.database.models.product_field_model import ProductFieldModel
from app.infrastructure.database.models.request_item_model import RequestItemModel
from app.infrastructure.database.models.request_item_field_model import RequestItemFieldModel

from app.repositories.product_repository import ProductRepository
from app.repositories.product_field_repository import ProductFieldRepository
from app.repositories.request_item_repository import RequestItemRepository

class ProductService:
    def __init__(
        self,
        *,
        product_repo: ProductRepository,
        pfield_repo: ProductFieldRepository,
        item_repo: RequestItemRepository,
    ) -> None:
        self._product_repo = product_repo
        self._pfield_repo = pfield_repo
        self._item_repo = item_repo

    def _get_field_value(self, fields: list[RequestItemFieldModel], tag: str) -> str:
        for f in fields:
            if f.field_tag == tag and (f.field_value or "").strip():
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

        # se já existe, atualiza
        self._pfield_repo.update_field(
            int(existing.id),
            {"field_type_id": int(field_type_id), "field_value": value, "field_flag": flag},
        )

    def apply_request_item_finalized(
        self,
        *,
        item: RequestItemModel,
        item_fields: list[RequestItemFieldModel],
    ) -> int:
        """
        Aplica o snapshot de RequestItemFields no Produto, criando/atualizando tbProduct e tbProductFields.
        Retorna product_id.
        """

        request_type_id = int(item.request_type_id)

        codigo_atual = self._get_field_value(item_fields, "codigo_atual")
        novo_codigo = self._get_field_value(item_fields, "novo_codigo")

        # --- validação de finalização (regras do enunciado) ---
        if request_type_id == 1:  # CREATE
            if not novo_codigo:
                raise ConflictError("Para finalizar CREATE, o campo 'novo_codigo' é obrigatório.")
            effective_code = novo_codigo

        elif request_type_id == 2:  # UPDATE
            if novo_codigo:
                effective_code = novo_codigo
            else:
                if not codigo_atual:
                    raise ConflictError("Para finalizar UPDATE, informe 'codigo_atual' (ou preencha 'novo_codigo').")
                effective_code = codigo_atual
        else:
            raise ConflictError("Tipo de solicitação inválido.")

        # --- encontra produto existente por codigo_atual/novo_codigo ---
        existing_product_id = self._pfield_repo.find_product_id_by_any_code(
            codigo_atual=codigo_atual or None,
            novo_codigo=novo_codigo or None,
        )

        # --- cria produto se não existe ---
        if existing_product_id is None:
            p = self._product_repo.add(ProductModel())
            product_id = int(p.id)
        else:
            product_id = int(existing_product_id)

        # --- aplica campos do item no produto (upsert por tag) ---
        for f in item_fields:
            if f.field_tag == "codigo_atual":
                # mantém codigo_atual como o "código efetivo" após aplicar
                self._upsert_product_field(
                    product_id=product_id,
                    field_type_id=int(f.field_type_id),
                    tag="codigo_atual",
                    value=effective_code,
                    flag=f.field_flag,
                )
                continue

            if f.field_tag == "novo_codigo":
                # se tem novo_codigo, grava. senão mantém como null (não inventa)
                val = (novo_codigo or "").strip() or None
                self._upsert_product_field(
                    product_id=product_id,
                    field_type_id=int(f.field_type_id),
                    tag="novo_codigo",
                    value=val,
                    flag=f.field_flag,
                )
                continue

            # demais campos: upsert 1:1
            self._upsert_product_field(
                product_id=product_id,
                field_type_id=int(f.field_type_id),
                tag=str(f.field_tag),
                value=f.field_value,
                flag=f.field_flag,
            )

        # atualiza product.updated_at
        self._product_repo.touch_updated_at(product_id)

        # seta item.product_id
        self._item_repo.update_fields(int(item.id), {"product_id": product_id})

        return product_id
