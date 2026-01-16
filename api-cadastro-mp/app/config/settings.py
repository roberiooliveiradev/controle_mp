# app/config/settings.py
import os
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    db_ssl: bool = False

    environment: str = "development"
    debug: bool = True

    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    jwt_access_minutes: int = int(os.getenv("JWT_ACCESS_MINUTES", "60"))

    jwt_issuer: str = os.getenv("JWT_ISSUER", "cadastro-mp-api")
    jwt_audience: str = os.getenv("JWT_AUDIENCE", "cadastro-mp-front")
    jwt_refresh_minutes: int = int(os.getenv("JWT_REFRESH_MINUTES", str(60 * 24 * 7)))

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("db_host", "db_name", "db_user", "db_password", mode="before")
    @classmethod
    def strip_strings(cls, v):
        if isinstance(v, str):
            return v.strip().strip('"').strip("'")
        return v

    @property
    def database_url(self) -> str:
        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)  # ✅ aqui resolve o '@' e qualquer caractere especial
        host = self.db_host
        port = self.db_port
        db = self.db_name

        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"


settings = Settings()
