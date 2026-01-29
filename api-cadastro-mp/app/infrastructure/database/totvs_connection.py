# app/infrastructure/database/totvs_connection.py
from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings
from app.core.exceptions import ConflictError


@lru_cache(maxsize=1)
def _get_totvs_sessionmaker() -> sessionmaker:
    """
    Cria e cacheia o sessionmaker do TOTVS.
    NÃO falha no import.
    Falha apenas quando for tentar usar e não estiver configurado.
    """
    url = settings.totvs_database_url
    if not url:
        raise ConflictError(
            "Configuração do banco TOTVS não definida. "
            "Defina TOTVS_DB_HOST/TOTVS_DB_NAME/TOTVS_DB_USER/TOTVS_DB_PASSWORD (e opcional TOTVS_DB_PORT)."
        )

    engine = create_engine(
        url,
        pool_pre_ping=True,
        future=True,
    )

    return sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )


def TotvsSessionLocal():
    """
    Factory de sessão.
    Uso: with TotvsSessionLocal() as session:
    """
    SessionLocal = _get_totvs_sessionmaker()
    return SessionLocal()
