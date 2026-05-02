# api-cadastro-mp/scripts/ensure_local_admin.py

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text  # noqa: E402

from app.config.settings import settings  # noqa: E402
from app.infrastructure.security.password_hasher import PasswordHasher  # noqa: E402


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()

    if not value:
        raise RuntimeError(f"Variável obrigatória ausente: {name}")

    return value


def main() -> None:
    enabled = env_bool("LOCAL_ADMIN_SEED_ENABLED", False)

    if not enabled:
        print("[controle-mp] Seed de admin local desativado.")
        return

    email = required_env("LOCAL_ADMIN_EMAIL").lower()
    password = required_env("LOCAL_ADMIN_PASSWORD")
    full_name = os.getenv("LOCAL_ADMIN_FULL_NAME", "Administrador").strip() or "Administrador"
    role_id = int(os.getenv("LOCAL_ADMIN_ROLE_ID", "1"))

    password_hash, password_salt, algo, iterations = PasswordHasher.hash_password(password)

    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
    )

    now = datetime.utcnow()

    sql = text(
        """
        INSERT INTO "tbUsers" (
            full_name,
            email,
            password_algo,
            password_iterations,
            password_hash,
            password_salt,
            role_id,
            created_at,
            updated_at,
            last_login,
            is_deleted
        )
        VALUES (
            :full_name,
            :email,
            :password_algo,
            :password_iterations,
            :password_hash,
            :password_salt,
            :role_id,
            :created_at,
            :updated_at,
            NULL,
            false
        )
        ON CONFLICT (email) DO UPDATE
        SET
            full_name = EXCLUDED.full_name,
            password_algo = EXCLUDED.password_algo,
            password_iterations = EXCLUDED.password_iterations,
            password_hash = EXCLUDED.password_hash,
            password_salt = EXCLUDED.password_salt,
            role_id = EXCLUDED.role_id,
            updated_at = EXCLUDED.updated_at,
            is_deleted = false;
        """
    )

    with engine.begin() as conn:
        conn.execute(
            sql,
            {
                "full_name": full_name,
                "email": email,
                "password_algo": algo,
                "password_iterations": iterations,
                "password_hash": password_hash,
                "password_salt": password_salt,
                "role_id": role_id,
                "created_at": now,
                "updated_at": now,
            },
        )

    print(f"[controle-mp] Admin local garantido: {email} role_id={role_id}")


if __name__ == "__main__":
    main()