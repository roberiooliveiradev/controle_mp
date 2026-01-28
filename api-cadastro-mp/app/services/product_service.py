# app/services/product_service.py
from sqlalchemy.orm import Session
from enum import IntEnum
from datetime import datetime, timezone
import json

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.infrastructure.database.models.product_model import ProductModel
from app.infrastructure.database.models.product_field_model import ProductFieldModel
from app.infrastructure.database.models.request_item_model import RequestItemModel
from app.infrastructure.database.models.request_item_field_model import RequestItemFieldModel

from app.repositories.product_repository import ProductRepository
from app.repositories.product_field_repository import ProductFieldRepository
from app.repositories.request_item_repository import RequestItemRepository
from app.repositories.totvs_product_repository import TotvsProductRepository

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
        totvs_repo: TotvsProductRepository | None = None, 
        product_notifier: ProductNotifier | None = None,
    ) -> None:
        self._product_repo = product_repo
        self._pfield_repo = pfield_repo
        self._item_repo = item_repo
        self._totvs_repo = totvs_repo
        self._product_notifier = product_notifier

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _get_field_value(self, fields: list[RequestItemFieldModel], tag: str) -> str:
        for f in fields:
            if str(f.field_tag) == str(tag) and (f.field_value or "").strip():
                return str(f.field_value).strip()
        return ""

    def _strip_or_none(self, v) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    def _totvs_as_product_fields(self, totvs: dict) -> list[tuple[str, str | None]]:
        """
        Converte payload TOTVS para tags do seu produto (tbProductFields).
        Você pode ajustar/melhorar esse mapping conforme o front usa os tags.
        """
        fornecedores = totvs.get("fornecedores")
        if isinstance(fornecedores, (list, dict)):
            fornecedores = json.dumps(fornecedores, ensure_ascii=False)

        return [
            ("codigo_atual", self._strip_or_none(totvs.get("codigo"))),
            ("descricao", self._strip_or_none(totvs.get("descricao"))),
            ("unidade", self._strip_or_none(totvs.get("unidade"))),
            ("grupo", self._strip_or_none(totvs.get("grupo"))),
            ("tipo", self._strip_or_none(totvs.get("tipo"))),
            ("armazem_padrao", self._strip_or_none(totvs.get("armazem_padrao"))),
            ("produto_terceiro", self._strip_or_none(totvs.get("produto_terceiro"))),
            ("ref_cliente", self._strip_or_none(totvs.get("ref_cliente"))),
            ("fornecedores", self._strip_or_none(fornecedores)),
        ]

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
    ) -> dict:
        """
        Finaliza a request aplicando no Produto os DADOS REAIS do TOTVS
        (mantendo o schema / field_type_id / flags conforme a request).
        Retorna um payload útil para auditoria/notificação.
        """

        request_type_id = int(item.request_type_id)

        codigo_atual = self._get_field_value(item_fields, "codigo_atual")
        novo_codigo = self._get_field_value(item_fields, "novo_codigo")

        if request_type_id == 1:  # CREATE
            if not novo_codigo:
                raise ConflictError("Para finalizar CREATE, o campo 'novo_codigo' é obrigatório.")
            effective_code = novo_codigo
            lookup_code = novo_codigo

        elif request_type_id == 2:  # UPDATE
            if not codigo_atual:
                raise ConflictError("Para finalizar UPDATE, informe 'codigo_atual'.")
            lookup_code = codigo_atual
            effective_code = novo_codigo if novo_codigo else codigo_atual

        else:
            raise ConflictError("Tipo de solicitação inválido.")

        # 1) resolve/cria produto por código
        existing_product_id = self._pfield_repo.find_product_id_by_codigo_atual(
            codigo_atual=lookup_code
        )

        created = existing_product_id is None
        if created:
            p = self._product_repo.add(ProductModel())
            product_id = int(p.id)
        else:
            product_id = int(existing_product_id)

        # 2) busca dados reais no TOTVS
        if not self._totvs_repo:
            raise ConflictError("Integração TOTVS não configurada no ProductService.")

        totvs_rows = self._totvs_repo.list_products(code=lookup_code)
        if not totvs_rows:
            raise ConflictError(f"Produto '{lookup_code}' não encontrado no TOTVS. Não é possível finalizar.")

        totvs = totvs_rows[0]

        # 3) mapeia TOTVS -> tags do seu produto
        #    (adicione/remova tags aqui conforme seu padrão do front)
        def totvs_value_for_tag(tag: str):
            tag = (tag or "").strip()

            # tags "de controle" (não vêm do TOTVS)
            if tag == "codigo_atual":
                return effective_code
            if tag == "novo_codigo":
                return None  # não persiste no produto

            # mapeamento direto TOTVS -> tags
            mapping = {
                "descricao": totvs.get("descricao"),
                "unidade": totvs.get("unidade"),
                "grupo": totvs.get("grupo"),
                "tipo": totvs.get("tipo"),
                "armazem_padrao": totvs.get("armazem_padrao"),
                "produto_terceiro": totvs.get("produto_terceiro"),
                "ref_cliente": totvs.get("ref_cliente"),

                # se vocês quiserem salvar isso como JSON (string) no product_fields:
                "fornecedores": totvs.get("fornecedores"),
            }

            return mapping.get(tag)

        # 4) aplica campos do produto usando o field_type_id da REQUEST por tag correspondente
        codigo_field_type_id: int | None = None
        codigo_field_flag: str | None = None

        for f in item_fields:
            tag = str(f.field_tag)

            # Ignora novo_codigo como campo do produto
            if tag == "novo_codigo":
                # mas aproveita para capturar tipo/flag caso codigo_atual não exista no item_fields
                if codigo_field_type_id is None:
                    codigo_field_type_id = int(f.field_type_id)
                    codigo_field_flag = f.field_flag
                continue

            # Captura tipo/flag do codigo_atual
            if tag == "codigo_atual":
                codigo_field_type_id = int(f.field_type_id)
                codigo_field_flag = f.field_flag
                # não dá upsert aqui ainda; fazemos depois com effective_code
                continue

            # Valor REAL do TOTVS para esta tag
            totvs_value = totvs_value_for_tag(tag)

            # Política de fallback (segura): se TOTVS não tiver, mantém valor da request
            value_to_apply = totvs_value if totvs_value is not None else f.field_value

            # Normalização simples (evita espaços do TOTVS)
            if isinstance(value_to_apply, str):
                value_to_apply = value_to_apply.strip()

            # Se fornecedores vier como lista/dict, serialize; se vier string, mantém e strip
            if tag == "fornecedores" and value_to_apply is not None:
                import json
                if isinstance(value_to_apply, (list, dict)):
                    value_to_apply = json.dumps(value_to_apply, ensure_ascii=False)
                elif isinstance(value_to_apply, str):
                    value_to_apply = value_to_apply.strip()

            self._upsert_product_field(
                product_id=product_id,
                field_type_id=int(f.field_type_id),  # ✅ tipo vem da request (campo correspondente)
                tag=tag,
                value=value_to_apply,
                flag=f.field_flag,  # ✅ mantém flag da request (se quiser “limpar”, troque por None)
            )

        if codigo_field_type_id is None:
            raise ConflictError("Não foi possível determinar o tipo do campo para 'codigo_atual'.")

        # 5) aplica codigo_atual (sempre effective_code)
        self._upsert_product_field(
            product_id=product_id,
            field_type_id=int(codigo_field_type_id),
            tag="codigo_atual",
            value=(effective_code.strip() if isinstance(effective_code, str) else effective_code),
            flag=codigo_field_flag,
        )

        self._product_repo.touch_updated_at(product_id)
        self._item_repo.update_fields(int(item.id), {"product_id": product_id})

        # Descrição: prefira TOTVS (real), fallback request
        descricao = totvs.get("descricao")
        if isinstance(descricao, str):
            descricao = descricao.strip()
        if not descricao:
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
