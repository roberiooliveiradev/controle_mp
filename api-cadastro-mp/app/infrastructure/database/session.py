# app/infrastructure/database/session.py

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config.settings import settings

_engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

_SessionLocal = sessionmaker(
    bind=_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,  
)


@contextmanager
def db_session() -> Iterator[Session]:
    session: Session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
