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

    files_storage_type: str = os.getenv("FILES_STORAGE_TYPE", "local")
    files_base_path: str = os.getenv("FILES_BASE_PATH", "./_uploads")
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "20"))

    # ✅ Whitelist de tipos permitidos
    # Ex: "application/pdf,image/png,image/jpeg"
    allowed_mime_types_raw: str = os.getenv(
        "ALLOWED_MIME_TYPES",
        ",".join(
            [
                # PDFs
                "application/pdf",

                # Imagens
                "image/png",
                "image/jpeg",
                "image/jpg",

                # Texto
                "text/plain",
                "text/csv",

                # Excel
                "application/vnd.ms-excel",  # .xls
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx

                # Word
                "application/msword",  # .doc
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx

                # PowerPoint
                "application/vnd.ms-powerpoint",  # .ppt
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
            ]
        ),
    )

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
        password = quote_plus(self.db_password) 
        host = self.db_host
        port = self.db_port
        db = self.db_name

        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"


settings = Settings()
