# api-cadastro-mp/scripts/run_database_migrations.py
from __future__ import annotations

import argparse
import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import psycopg2
import psycopg2.extras


ROOT_DIR = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = ROOT_DIR / "app" / "database" / "migrations"
SEEDS_DIR = ROOT_DIR / "app" / "database" / "seeds"

TRACKING_TABLE = '"tbSchemaMigrations"'

ScriptKind = Literal["migration", "seed"]


class MigrationError(RuntimeError):
    """Erro de execução de migrations/seeds do Controle MP."""


@dataclass(frozen=True)
class DatabaseSettings:
    host: str
    port: int
    database: str
    user: str
    password: str
    connect_timeout: int = 10
    sslmode: str = "prefer"

    @property
    def dsn(self) -> str:
        return (
            f"host={self.host} "
            f"port={self.port} "
            f"dbname={self.database} "
            f"user={self.user} "
            f"password={self.password} "
            f"connect_timeout={self.connect_timeout} "
            f"sslmode={self.sslmode}"
        )


def _get_required_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value

    joined = " ou ".join(names)
    raise MigrationError(f"Variável obrigatória ausente: {joined}")


def get_database_settings() -> DatabaseSettings:
    return DatabaseSettings(
        host=_get_required_env("DB_HOST", "DATABASE_HOST", "POSTGRES_HOST"),
        port=int(_get_required_env("DB_PORT", "DATABASE_PORT", "POSTGRES_PORT")),
        database=_get_required_env("DB_NAME", "DATABASE_NAME", "POSTGRES_DB"),
        user=_get_required_env("DB_USER", "DATABASE_USER", "POSTGRES_USER"),
        password=_get_required_env("DB_PASSWORD", "DATABASE_PASSWORD", "POSTGRES_PASSWORD"),
        connect_timeout=int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
        sslmode=os.getenv("DB_SSLMODE", "prefer").strip() or "prefer",
    )


def get_connection():
    settings = get_database_settings()
    return psycopg2.connect(settings.dsn)


def calculate_checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def quote_identifier(identifier: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
        raise MigrationError(f"Identificador PostgreSQL inválido: {identifier}")

    return f'"{identifier}"'


def normalize_sql(sql: str, *, settings: DatabaseSettings) -> str:
    """
    Ajuste específico para o arquivo legado 000_permisions.sql,
    que usa o placeholder user_name.

    Exemplo:
      GRANT ... TO user_name;
    vira:
      GRANT ... TO "controle_mp";
    """
    quoted_user = quote_identifier(settings.user)
    return re.sub(r"\buser_name\b", quoted_user, sql)


def ensure_tracking_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TRACKING_TABLE} (
                id BIGSERIAL PRIMARY KEY,
                kind VARCHAR(30) NOT NULL,
                version VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                checksum VARCHAR(64) NOT NULL,
                executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_schema_migrations_kind_version UNIQUE (kind, version)
            );
            """
        )

    conn.commit()


def parse_version_and_name(path: Path) -> tuple[str, str]:
    match = re.fullmatch(r"(?P<version>\d{3,})_(?P<name>.+)\.sql", path.name)

    if not match:
        raise MigrationError(
            f"Arquivo inválido: {path.name}. Use o padrão 001_nome_do_script.sql"
        )

    return match.group("version"), match.group("name")


def list_sql_files(directory: Path, *, kind: ScriptKind) -> list[Path]:
    if not directory.exists():
        raise MigrationError(f"Pasta não encontrada: {directory}")

    files = sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() == ".sql"
    )

    if not files:
        raise MigrationError(f"Nenhum arquivo SQL encontrado em: {directory}")

    if kind == "migration":
        # O arquivo 000_permisions.sql depende de tabelas/sequences já criadas
        # e contém grants. Por isso, ele é executado por último.
        permission_files = [
            path
            for path in files
            if "permission" in path.name.lower() or "permision" in path.name.lower()
        ]
        regular_files = [path for path in files if path not in permission_files]
        return regular_files + permission_files

    return files


def get_applied_scripts(conn) -> dict[tuple[str, str], dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f"""
            SELECT kind, version, name, filename, checksum, executed_at
            FROM {TRACKING_TABLE}
            ORDER BY kind ASC, version ASC
            """
        )
        rows = cur.fetchall()

    return {(row["kind"], row["version"]): dict(row) for row in rows}


def validate_history(conn, *, kind: ScriptKind, files: list[Path]) -> None:
    applied = get_applied_scripts(conn)

    for path in files:
        version, _ = parse_version_and_name(path)
        checksum = calculate_checksum(path)

        key = (kind, version)

        if key in applied:
            applied_checksum = applied[key]["checksum"]
            if checksum != applied_checksum:
                raise MigrationError(
                    f"Checksum divergente para {path.name}. "
                    "O arquivo já aplicado foi alterado."
                )


def apply_sql_file(conn, *, kind: ScriptKind, path: Path, settings: DatabaseSettings) -> None:
    version, name = parse_version_and_name(path)
    checksum = calculate_checksum(path)

    sql = path.read_text(encoding="utf-8")
    sql = normalize_sql(sql, settings=settings)

    print(f"-> Aplicando {kind}: {path.name}")

    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                f"""
                INSERT INTO {TRACKING_TABLE}
                    (kind, version, name, filename, checksum)
                VALUES
                    (%s, %s, %s, %s, %s)
                """,
                (kind, version, name, path.name, checksum),
            )

        conn.commit()
        print(f"   OK: {path.name}")

    except Exception as exc:
        conn.rollback()
        raise MigrationError(f"Falha ao aplicar {path.name}: {exc}") from exc


def run_scripts(*, kind: ScriptKind, directory: Path) -> None:
    settings = get_database_settings()
    files = list_sql_files(directory, kind=kind)

    with get_connection() as conn:
        ensure_tracking_table(conn)
        validate_history(conn, kind=kind, files=files)

        applied = get_applied_scripts(conn)
        pending: list[Path] = []

        for path in files:
            version, _ = parse_version_and_name(path)
            if (kind, version) not in applied:
                pending.append(path)

        if not pending:
            print(f"Nenhum {kind} pendente.")
            return

        print(f"Executando {kind}s pendentes...")
        for path in pending:
            apply_sql_file(conn, kind=kind, path=path, settings=settings)

        print(f"{kind.capitalize()}s aplicados com sucesso.")


def run_up(*, run_seeds: bool = True) -> None:
    run_scripts(kind="migration", directory=MIGRATIONS_DIR)

    if run_seeds:
        run_scripts(kind="seed", directory=SEEDS_DIR)


def assert_existing_database_has_core_tables(conn) -> None:
    required_tables = [
        "tbUsers",
        "tbRoles",
        "tbConversations",
        "tbMessages",
    ]

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name = ANY(%s)
            """,
            (required_tables,),
        )
        existing = {row[0] for row in cur.fetchall()}

    missing = [name for name in required_tables if name not in existing]

    if missing:
        raise MigrationError(
            "Baseline bloqueado. O banco não parece estar inicializado. "
            f"Tabelas ausentes: {', '.join(missing)}"
        )


def baseline_script(conn, *, kind: ScriptKind, path: Path) -> None:
    version, name = parse_version_and_name(path)
    checksum = calculate_checksum(path)

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f"""
            SELECT checksum
            FROM {TRACKING_TABLE}
            WHERE kind = %s
              AND version = %s
            """,
            (kind, version),
        )
        existing = cur.fetchone()

        if existing:
            if existing["checksum"] != checksum:
                raise MigrationError(
                    f"Checksum divergente no baseline para {path.name}. "
                    "Existe registro anterior com checksum diferente."
                )

            print(f"= Já registrado: {kind} {path.name}")
            return

        cur.execute(
            f"""
            INSERT INTO {TRACKING_TABLE}
                (kind, version, name, filename, checksum)
            VALUES
                (%s, %s, %s, %s, %s)
            """,
            (kind, version, name, path.name, checksum),
        )

    print(f"+ Baseline registrado: {kind} {path.name}")


def run_baseline() -> None:
    migration_files = list_sql_files(MIGRATIONS_DIR, kind="migration")
    seed_files = list_sql_files(SEEDS_DIR, kind="seed")

    with get_connection() as conn:
        ensure_tracking_table(conn)
        assert_existing_database_has_core_tables(conn)

        try:
            print("Criando baseline de migrations...")
            for path in migration_files:
                baseline_script(conn, kind="migration", path=path)

            print("Criando baseline de seeds...")
            for path in seed_files:
                baseline_script(conn, kind="seed", path=path)

            conn.commit()
            print("Baseline concluído com sucesso.")

        except Exception:
            conn.rollback()
            raise


def show_status_for(*, kind: ScriptKind, directory: Path) -> None:
    files = list_sql_files(directory, kind=kind)

    with get_connection() as conn:
        ensure_tracking_table(conn)
        validate_history(conn, kind=kind, files=files)

        applied = get_applied_scripts(conn)

        print(f"Status de {kind}s:")
        for path in files:
            version, name = parse_version_and_name(path)
            status = "APLICADO" if (kind, version) in applied else "PENDENTE"
            print(f"- {version} | {name} | {status}")


def show_status() -> None:
    show_status_for(kind="migration", directory=MIGRATIONS_DIR)
    print("")
    show_status_for(kind="seed", directory=SEEDS_DIR)


def reset_database() -> None:
    allow_reset = os.getenv("ALLOW_DATABASE_RESET", "false").lower() == "true"

    if not allow_reset:
        raise MigrationError(
            "Reset bloqueado. Defina ALLOW_DATABASE_RESET=true para permitir."
        )

    settings = get_database_settings()

    with get_connection() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET lock_timeout = '5s';")
                cur.execute("SET statement_timeout = '30s';")

                cur.execute("DROP SCHEMA IF EXISTS public CASCADE;")
                cur.execute("CREATE SCHEMA public;")
                cur.execute("GRANT ALL ON SCHEMA public TO public;")
                cur.execute(f"GRANT ALL ON SCHEMA public TO {quote_identifier(settings.user)};")

            conn.commit()
            print("Schema public recriado com sucesso.")

        except Exception as exc:
            conn.rollback()
            raise MigrationError(f"Falha ao resetar banco: {exc}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Runner de migrations e seeds do Controle MP."
    )

    parser.add_argument(
        "command",
        choices=["up", "migrate", "seed", "status", "baseline", "reset"],
        help=(
            "up: aplica migrations e seeds | "
            "migrate: aplica apenas migrations | "
            "seed: aplica apenas seeds | "
            "status: mostra status | "
            "baseline: registra migrations/seeds existentes sem executar SQL | "
            "reset: recria schema public"
        ),
    )

    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="Usado com up para aplicar apenas migrations.",
    )

    args = parser.parse_args()

    if args.command == "up":
        run_up(run_seeds=not args.no_seed)
        return

    if args.command == "migrate":
        run_scripts(kind="migration", directory=MIGRATIONS_DIR)
        return

    if args.command == "seed":
        run_scripts(kind="seed", directory=SEEDS_DIR)
        return

    if args.command == "status":
        show_status()
        return

    if args.command == "baseline":
        run_baseline()
        return

    if args.command == "reset":
        reset_database()
        return


if __name__ == "__main__":
    main()