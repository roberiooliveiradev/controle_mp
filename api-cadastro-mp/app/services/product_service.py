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

        # --- validação de finalização (mantém suas regras atuais) ---
        if request_type_id == 1:  # CREATE
            if not novo_codigo:
                raise ConflictError("Para finalizar CREATE, o campo 'novo_codigo' é obrigatório.")
            effective_code = novo_codigo

            # ✅ CREATE: procurar existente por codigo_atual == novo_codigo (porque produto só tem codigo_atual)
            lookup_code = novo_codigo

        elif request_type_id == 2:  # UPDATE
            # ✅ UPDATE: usa codigo_atual como chave do produto (é o código atual do produto)
            if not codigo_atual:
                raise ConflictError("Para finalizar UPDATE, informe 'codigo_atual'.")
            lookup_code = codigo_atual

            # ✅ se veio novo_codigo, ele sobrescreve o codigo_atual do produto
            effective_code = novo_codigo if novo_codigo else codigo_atual

        else:
            raise ConflictError("Tipo de solicitação inválido.")

        # --- encontra produto existente SOMENTE por codigo_atual ---
        existing_product_id = self._pfield_repo.find_product_id_by_codigo_atual(
            codigo_atual=lookup_code
        )

        # --- cria produto se não existe ---
        if existing_product_id is None:
            p = self._product_repo.add(ProductModel())
            product_id = int(p.id)
        else:
            product_id = int(existing_product_id)
        
        # --- aplica campos do item no produto (upsert por tag) ---
        codigo_field_type_id: int | None = None
        codigo_field_flag: str | None = None

        for f in item_fields:
            tag = str(f.field_tag)

            # capturar metadados do campo de código (pra usar no upsert garantido)
            if tag == "codigo_atual":
                codigo_field_type_id = int(f.field_type_id)
                codigo_field_flag = f.field_flag
                # não faz upsert aqui — vamos garantir no final
                continue

            if tag == "novo_codigo":
                # no CREATE geralmente só existe este; vamos usar seus metadados
                if codigo_field_type_id is None:
                    codigo_field_type_id = int(f.field_type_id)
                    codigo_field_flag = f.field_flag
                # ✅ NÃO grava novo_codigo no produto
                continue

            # demais campos: upsert 1:1
            self._upsert_product_field(
                product_id=product_id,
                field_type_id=int(f.field_type_id),
                tag=tag,
                value=f.field_value,
                flag=f.field_flag,
            )

        # ✅ GARANTIA: produto sempre recebe codigo_atual (mesmo quando só veio novo_codigo no CREATE)
        if codigo_field_type_id is None:
            # fallback defensivo (caso item_fields venha sem os campos)
            raise ConflictError("Não foi possível determinar o tipo do campo para 'codigo_atual'.")

        self._upsert_product_field(
            product_id=product_id,
            field_type_id=int(codigo_field_type_id),
            tag="codigo_atual",
            value=effective_code,
            flag=codigo_field_flag,
        )


        self._product_repo.touch_updated_at(product_id)

        # seta item.product_id (amarração da request finalizada ao produto)
        self._item_repo.update_fields(int(item.id), {"product_id": product_id})

        return product_id