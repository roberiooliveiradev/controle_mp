# app/repositories/request_item_repository.py

from datetime import date
from sqlalchemy import select, update, func, or_
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.request_item_model import RequestItemModel
from app.infrastructure.database.models.request_model import RequestModel
from app.infrastructure.database.models.message_model import MessageModel
from app.infrastructure.database.models.user_model import UserModel
from app.infrastructure.database.models.request_type_model import RequestTypeModel


class RequestItemRepository(BaseRepository[RequestItemModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def add(self, model: RequestItemModel) -> RequestItemModel:
        self._session.add(model)
        self._session.flush()
        return model

    def get_by_id(self, item_id: int) -> RequestItemModel | None:
        stmt = select(RequestItemModel).where(
            RequestItemModel.id == item_id,
            RequestItemModel.is_deleted.is_(False),
        )
        return self._session.execute(stmt).scalars().first()

    def list_by_request_id(self, request_id: int) -> list[RequestItemModel]:
        stmt = (
            select(RequestItemModel)
            .where(RequestItemModel.request_id == request_id, RequestItemModel.is_deleted.is_(False))
            .order_by(RequestItemModel.id.asc())
        )
        return list(self._session.execute(stmt).scalars().all())

    def update_fields(self, item_id: int, values: dict) -> bool:
        if not values:
            return True
        stmt = (
            update(RequestItemModel)
            .where(RequestItemModel.id == item_id, RequestItemModel.is_deleted.is_(False))
            .values(**values, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def touch_updated_at(self, item_id: int) -> bool:
        stmt = (
            update(RequestItemModel)
            .where(RequestItemModel.id == item_id, RequestItemModel.is_deleted.is_(False))
            .values(updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def soft_delete(self, item_id: int) -> bool:
        stmt = (
            update(RequestItemModel)
            .where(RequestItemModel.id == item_id, RequestItemModel.is_deleted.is_(False))
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def soft_delete_by_request_id(self, request_id: int) -> int:
        stmt = (
            update(RequestItemModel)
            .where(
                RequestItemModel.request_id == request_id,
                RequestItemModel.is_deleted.is_(False),
            )
            .values(is_deleted=True, updated_at=func.now())
        )
        res = self._session.execute(stmt)
        return int(res.rowcount or 0)

    def _date_target_col(self, date_mode: str):
        # CREATED -> item.created_at
        # UPDATED -> item.updated_at
        # AUTO   -> coalesce(item.updated_at, item.created_at)
        if date_mode == "CREATED":
            return RequestItemModel.created_at
        if date_mode == "UPDATED":
            return RequestItemModel.updated_at
        return func.coalesce(RequestItemModel.updated_at, RequestItemModel.created_at)

    # -------- Listagem para tela --------
    def list_items_for_page(
        self,
        *,
        limit: int,
        offset: int,
        status_id: int | None,
        # novos filtros
        created_by_user_id: int | None,
        created_by_name: str | None,
        type_id: int | None,
        type_q: str | None,
        item_id: int | None,
        date_from: date | None,
        date_to: date | None,
        date_mode: str,  # AUTO | CREATED | UPDATED
    ) -> tuple[list[dict], int]:
        """Lista RequestItems com contexto (request/message/conversation) para a UI."""

        target_dt_col = self._date_target_col(date_mode)

        base_stmt = (
            select(
                RequestModel.id.label("request_id"),
                RequestModel.created_by.label("request_created_by"),
                RequestModel.created_at.label("request_created_at"),
                RequestModel.updated_at.label("request_updated_at"),
                RequestModel.message_id.label("message_id"),
                UserModel.id.label("user_id"),
                UserModel.full_name.label("user_full_name"),
                UserModel.email.label("user_email"),
                MessageModel.conversation_id.label("conversation_id"),
                RequestItemModel.id.label("item_id"),
                RequestItemModel.request_type_id.label("request_type_id"),
                RequestItemModel.request_status_id.label("request_status_id"),
                RequestItemModel.product_id.label("product_id"),
                RequestItemModel.created_at.label("item_created_at"),
                RequestItemModel.updated_at.label("item_updated_at"),
            )
            .select_from(RequestItemModel)
            .join(RequestModel, RequestModel.id == RequestItemModel.request_id)
            .join(UserModel, UserModel.id == RequestModel.created_by)
            .join(MessageModel, MessageModel.id == RequestModel.message_id)
            .join(RequestTypeModel, RequestTypeModel.id == RequestItemModel.request_type_id)
            .where(RequestItemModel.is_deleted.is_(False))
            .where(RequestModel.is_deleted.is_(False))
            .where(RequestTypeModel.is_deleted.is_(False))
        )

        # status
        if status_id is not None:
            base_stmt = base_stmt.where(RequestItemModel.request_status_id == int(status_id))

        # item id
        if item_id is not None:
            base_stmt = base_stmt.where(RequestItemModel.id == int(item_id))

        # created_by (user_id)
        if created_by_user_id is not None:
            base_stmt = base_stmt.where(RequestModel.created_by == int(created_by_user_id))

        # created_by_name (full_name/email)
        if created_by_name:
            q = f"%{created_by_name.strip()}%"
            base_stmt = base_stmt.where(or_(UserModel.full_name.ilike(q), UserModel.email.ilike(q)))

        # tipo (id exato)
        if type_id is not None:
            base_stmt = base_stmt.where(RequestItemModel.request_type_id == int(type_id))

        # tipo (nome contém)
        if type_q:
            q = f"%{type_q.strip()}%"
            base_stmt = base_stmt.where(RequestTypeModel.type_name.ilike(q))

        # range de datas (por dia, sem dor de timezone)
        if date_from is not None:
            base_stmt = base_stmt.where(func.date(target_dt_col) >= date_from)
        if date_to is not None:
            base_stmt = base_stmt.where(func.date(target_dt_col) <= date_to)

        total_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = int(self._session.execute(total_stmt).scalar_one())

        # ordenação: mais recente (updated_at se existir, senão created_at)
        sort_col = func.coalesce(RequestItemModel.updated_at, RequestItemModel.created_at)
        page_stmt = base_stmt.order_by(sort_col.desc(), RequestItemModel.id.desc()).limit(int(limit)).offset(int(offset))

        rows = self._session.execute(page_stmt).mappings().all()

        out: list[dict] = []
        for r in rows:
            out.append(
                {
                    "request_id": int(r["request_id"]),
                    "request_created_by": int(r["request_created_by"]),
                    "request_created_by_user": {
                        "id": int(r["user_id"]),
                        "full_name": r["user_full_name"],
                        "email": r["user_email"],
                    },
                    "request_created_at": r["request_created_at"],
                    "request_updated_at": r["request_updated_at"],
                    "message_id": int(r["message_id"]),
                    "conversation_id": int(r["conversation_id"]),
                    "item_id": int(r["item_id"]),
                    "request_type_id": int(r["request_type_id"]),
                    "request_status_id": int(r["request_status_id"]),
                    "product_id": r["product_id"],
                    "item_created_at": r["item_created_at"],
                    "item_updated_at": r["item_updated_at"],
                    "fields_count": 0,
                }
            )

        return out, total
