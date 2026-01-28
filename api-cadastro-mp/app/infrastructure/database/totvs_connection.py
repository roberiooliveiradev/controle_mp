# app/infrastructure/database/totvs_connection.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings

if not settings.totvs_database_url:
    raise RuntimeError("Configuração do banco TOTVS não definida")

totvs_engine = create_engine(
    settings.totvs_database_url,
    pool_pre_ping=True,
)

TotvsSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=totvs_engine,
)
