# app/repositories/request_item_repository.py

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.request_item_model import RequestItemModel
from app.infrastructure.database.models.request_model import RequestModel
from app.infrastructure.database.models.message_model import MessageModel
from app.infrastructure.database.models.user_model import UserModel


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

    # -------- Listagem para tela --------
    def list_items_for_page(
        self,
        *,
        limit: int,
        offset: int,
        status_id: int | None,
        created_by: int | None,
    ) -> tuple[list[dict], int]:
        """Lista RequestItems com contexto (request/message/conversation) para a UI."""

        base_stmt = (
            select(
                RequestModel.id.label("request_id"),
                RequestModel.created_by.label("request_created_by"),
                RequestModel.created_at.label("request_created_at"),
                RequestModel.updated_at.label("request_updated_at"),
                RequestModel.message_id.label("message_id"),
                UserModel.id.label("user_id"),
                UserModel.full_name.label("user_full_name"),
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
            .where(RequestItemModel.is_deleted.is_(False))
            .where(RequestModel.is_deleted.is_(False))
        )

        if status_id is not None:
            base_stmt = base_stmt.where(RequestItemModel.request_status_id == int(status_id))
        if created_by is not None:
            base_stmt = base_stmt.where(RequestModel.created_by == int(created_by))

        total_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = int(self._session.execute(total_stmt).scalar_one())

        page_stmt = (
            base_stmt.order_by(RequestItemModel.created_at.desc())
            .limit(int(limit))
            .offset(int(offset))
        )
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
