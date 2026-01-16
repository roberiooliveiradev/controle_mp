from typing import Generic, TypeVar
from sqlalchemy.orm import Session

TModel = TypeVar("TModel")

class BaseRepository(Generic[TModel]):
    def __init__(self, session: Session) -> None:
        self._session = session
