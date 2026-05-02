#!/bin/sh
set -e

if [ "${RUN_DATABASE_MIGRATIONS_ON_STARTUP:-false}" = "true" ]; then
  echo "[controle-mp] Executando migrations/seeds no startup..."
  python scripts/run_database_migrations.py up
fi

if [ "${LOCAL_ADMIN_SEED_ENABLED:-false}" = "true" ]; then
  echo "[controle-mp] Garantindo admin local..."
  python scripts/ensure_local_admin.py
fi

exec "$@"