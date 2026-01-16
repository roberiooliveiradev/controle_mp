# app/repositories/conversation_repository.py
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session, aliased

from app.core.base_repository import BaseRepository
from app.infrastructure.database.models.conversation_model import ConversationModel
from app.infrastructure.database.models.user_model import UserModel


class ConversationRepository(BaseRepository[ConversationModel]):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def _order_by_last_activity(self):
        # ORDER BY COALESCE(updated_at, created_at) DESC
        return func.coalesce(ConversationModel.updated_at, ConversationModel.created_at).desc()

    def _base_rows_stmt(self):
        creator = aliased(UserModel)
        assignee = aliased(UserModel)

        stmt = (
            select(ConversationModel, creator, assignee)
            .join(creator, creator.id == ConversationModel.created_by)
            .outerjoin(assignee, assignee.id == ConversationModel.assigned_to)
            .where(ConversationModel.is_deleted.is_(False))
        )
        return stmt, creator, assignee

    def list_all_conversations_rows(self, limit: int = 50, offset: int = 0):
        stmt, _, _ = self._base_rows_stmt()
        stmt = stmt.order_by(self._order_by_last_activity()).limit(limit).offset(offset)
        return list(self._session.execute(stmt).all())

    def list_my_conversations_rows(self, user_id: int, limit: int = 50, offset: int = 0):
        stmt, _, _ = self._base_rows_stmt()
        stmt = (
            stmt.where(ConversationModel.created_by == user_id)
            .order_by(self._order_by_last_activity())
            .limit(limit)
            .offset(offset)
        )
        return list(self._session.execute(stmt).all())

    def get_row_by_id(self, conversation_id: int):
        stmt, _, _ = self._base_rows_stmt()
        stmt = stmt.where(ConversationModel.id == conversation_id)
        return self._session.execute(stmt).first()  # (conv, creator, assignee) | None

    def add(self, model: ConversationModel) -> ConversationModel:
        self._session.add(model)
        self._session.flush()
        return model

    def update_fields(
        self,
        *,
        conversation_id: int,
        title: str | None,
        has_flag: bool | None,
        assigned_to: int | None,
    ) -> bool:
        values = {}
        if title is not None:
            values["title"] = title.strip()
        if has_flag is not None:
            values["has_flag"] = has_flag
        # assigned_to pode ser None (desatribuir)
        if assigned_to is not None or assigned_to is None:
            values["assigned_to"] = assigned_to

        if not values:
            return True  # nada a alterar

        stmt = (
            update(ConversationModel)
            .where(ConversationModel.id == conversation_id, ConversationModel.is_deleted.is_(False))
            .values(**values)
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0

    def touch(self, conversation_id: int) -> None:
        stmt = (
            update(ConversationModel)
            .where(ConversationModel.id == conversation_id, ConversationModel.is_deleted.is_(False))
            .values(updated_at=func.now())
        )
        self._session.execute(stmt)
    
    def soft_delete(self, conversation_id: int) -> bool:
        stmt = (
            update(ConversationModel)
            .where(ConversationModel.id == conversation_id, ConversationModel.is_deleted.is_(False))
            .values(is_deleted=True)
        )
        res = self._session.execute(stmt)
        return (res.rowcount or 0) > 0
