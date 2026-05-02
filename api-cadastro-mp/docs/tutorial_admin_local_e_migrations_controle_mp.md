# Tutorial — Admin local por `.env`, seeds, migrations e deploy seguro do Controle MP

## Objetivo

Este documento registra o procedimento oficial para configurar o **admin local automático** do Controle MP em ambientes locais e em produção, sem expor senha fixa em SQL e sem perder dados existentes.

O fluxo atual usa:

- migrations/seeds controlados por `scripts/run_database_migrations.py`;
- histórico e checksum em `tbSchemaMigrations`;
- seed SQL `003_admin_user.sql` transformado em no-op;
- script Python `scripts/ensure_local_admin.py` para criar/atualizar o admin usando variáveis da `.env`;
- `docker-entrypoint.sh` para executar migrations e depois garantir o admin local.

---

## Regra mais importante

Em **ambiente local novo**, o banco pode ser apagado e recriado com `down -v`.

Em **produção**, onde já existem dados gravados, **não usar `down -v`**, **não remover volumes**, **não restaurar banco sem backup** e **não alterar seeds já aplicados sem planejar checksum**.

---

## Por que mudamos o seed do admin

Antes existia um seed SQL criando um usuário placeholder como:

```text
admin@controlemp.local
HASH_EXEMPLO
SALT_EXEMPLO
```

Esse modelo tinha dois problemas:

1. `admin@controlemp.local` pode quebrar validação de email em schemas de resposta.
2. `HASH_EXEMPLO` e `SALT_EXEMPLO` não representam uma senha válida.

A solução correta é deixar a senha em variável de ambiente e gerar o hash com o mesmo mecanismo oficial da aplicação.

---

## Variáveis de ambiente necessárias

Adicionar no `.env` local e, se desejado, no `.env.production`:

```env
# --------------------------------------------------------
# Admin local inicial
# --------------------------------------------------------
LOCAL_ADMIN_SEED_ENABLED=true
LOCAL_ADMIN_EMAIL=admin@local.com
LOCAL_ADMIN_PASSWORD=Te1xe1r@1995
LOCAL_ADMIN_FULL_NAME=Administrador
LOCAL_ADMIN_ROLE_ID=1
```

Em produção, caso não queira que o entrypoint reforce esse admin a cada start, usar:

```env
LOCAL_ADMIN_SEED_ENABLED=false
```

Se a produção precisa garantir esse admin operacional, pode usar `true`, desde que o email e senha estejam definidos corretamente e que isso esteja alinhado com a política de segurança do ambiente.

---

## Seed SQL `003_admin_user.sql`

O arquivo:

```text
api-cadastro-mp/app/database/seeds/003_admin_user.sql
```

Deve ficar como no-op:

```sql
-- ========================================================
-- CONTROLE MP — ADMIN LOCAL
--
-- O admin local NÃO é mais criado diretamente por SQL,
-- porque a senha deve vir da .env e o hash deve ser gerado
-- pelo PasswordHasher oficial da aplicação.
--
-- Ver:
-- scripts/ensure_local_admin.py
-- ========================================================

SELECT 1;
```

Isso impede a criação de usuário inválido e mantém o arquivo dentro do fluxo de seeds.

---

## Script `ensure_local_admin.py`

Criar o arquivo:

```text
api-cadastro-mp/scripts/ensure_local_admin.py
```

Com responsabilidade de:

- ler `LOCAL_ADMIN_SEED_ENABLED`;
- ler `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`, `LOCAL_ADMIN_FULL_NAME`, `LOCAL_ADMIN_ROLE_ID`;
- gerar hash/salt com `PasswordHasher.hash_password()`;
- inserir ou atualizar o usuário em `tbUsers`;
- garantir `role_id = 1` e `is_deleted = false`.

Modelo final:

```python
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
```

---

## Entrypoint da API

O arquivo:

```text
api-cadastro-mp/docker-entrypoint.sh
```

Deve ficar assim:

```sh
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
```

Garantir permissão de execução:

```bash
chmod +x api-cadastro-mp/docker-entrypoint.sh
```

---

# Procedimento para ambientes locais novos

Use este fluxo quando o ambiente local pode ser recriado do zero.

## 1. Atualizar `.env`

Confirmar:

```env
RUN_DATABASE_MIGRATIONS_ON_STARTUP=true
ALLOW_DATABASE_RESET=false

LOCAL_ADMIN_SEED_ENABLED=true
LOCAL_ADMIN_EMAIL=admin@local.com
LOCAL_ADMIN_PASSWORD=Te1xe1r@1995
LOCAL_ADMIN_FULL_NAME=Administrador
LOCAL_ADMIN_ROLE_ID=1
```

## 2. Derrubar removendo volumes

Na raiz do projeto:

```bash
cd ~/projetos/controle_mp

docker compose -f docker-compose.local.yml --env-file .env down -v --remove-orphans
```

## 3. Subir com build

```bash
docker compose -f docker-compose.local.yml --env-file .env up --build -d
```

## 4. Conferir logs da API

```bash
docker logs -f controle-mp-api
```

Esperado:

```text
[controle-mp] Executando migrations/seeds no startup...
...
[controle-mp] Garantindo admin local...
[controle-mp] Admin local garantido: admin@local.com role_id=1
Starting gunicorn...
```

## 5. Validar usuário no banco

```bash
docker exec -it controle-mp-db psql \
  -U controle_mp \
  -d controle_mp_db \
  -c 'SELECT id, full_name, email, role_id, is_deleted FROM "tbUsers" ORDER BY id;'
```

Esperado:

```text
admin@local.com | role_id 1 | is_deleted false
```

## 6. Testar login

```text
Email: admin@local.com
Senha: Te1xe1r@1995
```

---

# Procedimento para ambiente local já existente

Se o banco local já existe e apareceu erro de checksum como:

```text
MigrationError: Checksum divergente para 003_admin_user.sql. O arquivo já aplicado foi alterado.
```

Há duas opções.

## Opção A — ambiente local pode ser apagado

Usar o fluxo de ambiente local novo:

```bash
docker compose -f docker-compose.local.yml --env-file .env down -v --remove-orphans
docker compose -f docker-compose.local.yml --env-file .env up --build -d
```

## Opção B — ambiente local não pode ser apagado

Não alterar histórico manualmente sem necessidade. Para testar a API sem resetar dados, pode rodar o admin manualmente depois que a API estiver com código atualizado:

```bash
docker exec -it controle-mp-api sh -lc 'python scripts/ensure_local_admin.py'
```

Se a API nem inicia por checksum divergente, o recomendado em local é apagar o volume. Em produção, seguir o procedimento seguro de produção abaixo.

---

# Procedimento seguro para produção com dados existentes

A produção já possui dados gravados. O objetivo é atualizar o código sem perder dados.

## Regras obrigatórias em produção

Nunca executar:

```bash
docker compose down -v
```

Nunca remover manualmente o volume do banco de produção.

Nunca restaurar dump sobre o banco atual sem backup validado.

Nunca alterar seed já aplicado em produção sem tratar o checksum conscientemente.

---

## 1. Fazer backup antes de qualquer mudança

### Backup do banco

Ajustar nome do container conforme produção.

```bash
mkdir -p ~/backups/controle-mp

BACKUP_FILE=~/backups/controle-mp/controle_mp_pre_admin_env_$(date +%Y%m%d_%H%M%S).sql

docker exec -t controle-mp-prod-db pg_dump \
  -U controle_mp \
  -d controle_mp_db \
  > "$BACKUP_FILE"

ls -lh "$BACKUP_FILE"
```

### Backup dos uploads

```bash
sudo tar -czf ~/backups/controle-mp/uploads_pre_admin_env_$(date +%Y%m%d_%H%M%S).tar.gz \
  /var/lib/controle_mp/uploads \
  2>/dev/null || true

ls -lh ~/backups/controle-mp
```

---

## 2. Verificar estado atual do banco

```bash
docker exec -it controle-mp-prod-db psql \
  -U controle_mp \
  -d controle_mp_db \
  -c 'SELECT id, full_name, email, role_id, is_deleted FROM "tbUsers" ORDER BY id;'
```

Verificar histórico de seeds/migrations:

```bash
docker exec -it controle-mp-prod-db psql \
  -U controle_mp \
  -d controle_mp_db \
  -c 'SELECT id, kind, name, filename, checksum, applied_at FROM "tbSchemaMigrations" ORDER BY id;'
```

---

## 3. Configurar `.env.production`

Há duas estratégias.

### Estratégia recomendada: não recriar admin automaticamente em produção

Se a produção já possui usuários administradores válidos:

```env
LOCAL_ADMIN_SEED_ENABLED=false
```

Nesse caso, o script não roda e não altera usuários existentes.

### Estratégia alternativa: garantir admin operacional em produção

Se for necessário garantir o admin local em produção:

```env
LOCAL_ADMIN_SEED_ENABLED=true
LOCAL_ADMIN_EMAIL=admin@local.com
LOCAL_ADMIN_PASSWORD=<senha-forte-de-producao>
LOCAL_ADMIN_FULL_NAME=Administrador
LOCAL_ADMIN_ROLE_ID=1
```

Evitar reutilizar senha fraca em produção. Definir senha forte e armazenar com segurança.

---

## 4. Importante sobre checksum de seed já aplicado

Se `003_admin_user.sql` já foi aplicado em produção e o arquivo foi alterado para `SELECT 1;`, o runner pode bloquear o startup com:

```text
MigrationError: Checksum divergente para 003_admin_user.sql. O arquivo já aplicado foi alterado.
```

Isso acontece porque o histórico em `tbSchemaMigrations` guarda o checksum do arquivo aplicado.

### Caminho seguro recomendado em produção

1. Não depender de alterar seed antigo para executar bootstrap.
2. Garantir backup antes.
3. Subir o código em janela controlada.
4. Se o runner bloquear por checksum divergente, não apagar volume e não rodar reset.
5. Atualizar o checksum registrado apenas para o seed transformado em no-op, após confirmar que o novo conteúdo é intencional.

A atualização de checksum deve ser feita com muito cuidado e apenas para o registro do arquivo `003_admin_user.sql`.

---

## 5. Como calcular o novo checksum do seed no container

Depois do deploy do código novo, calcular o checksum do arquivo dentro do container ou no host com o mesmo arquivo.

Exemplo no container da API:

```bash
docker exec -it controle-mp-prod-api sh -lc \
'python - <<"PY"
import hashlib
from pathlib import Path
path = Path("/app/app/database/seeds/003_admin_user.sql")
print(hashlib.sha256(path.read_bytes()).hexdigest())
PY'
```

Copiar o hash impresso.

---

## 6. Atualizar checksum do seed em produção, se necessário

Somente depois de backup e conferência.

```bash
docker exec -it controle-mp-prod-db psql \
  -U controle_mp \
  -d controle_mp_db
```

Dentro do `psql`:

```sql
BEGIN;

UPDATE "tbSchemaMigrations"
SET checksum = '<NOVO_CHECKSUM>'
WHERE kind = 'seed'
  AND filename = '003_admin_user.sql';

SELECT id, kind, name, filename, checksum, applied_at
FROM "tbSchemaMigrations"
WHERE kind = 'seed'
  AND filename = '003_admin_user.sql';

COMMIT;
```

Depois reiniciar apenas a API:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate controle-mp-api
```

Ver logs:

```bash
docker logs --tail 120 controle-mp-prod-api
```

Esperado:

```text
[controle-mp] Executando migrations/seeds no startup...
Nenhum migration pendente.
Nenhum seed pendente.
[controle-mp] Seed de admin local desativado.
Starting gunicorn...
```

Ou, se `LOCAL_ADMIN_SEED_ENABLED=true`:

```text
[controle-mp] Garantindo admin local...
[controle-mp] Admin local garantido: admin@local.com role_id=1
Starting gunicorn...
```

---

# Como corrigir produção caso exista `admin@controlemp.local`

Se o banco de produção tiver o usuário inválido:

```bash
docker exec -it controle-mp-prod-db psql \
  -U controle_mp \
  -d controle_mp_db \
  -c 'SELECT id, full_name, email, role_id, is_deleted FROM "tbUsers" ORDER BY id;'
```

Desativar o placeholder:

```bash
docker exec -it controle-mp-prod-db psql \
  -U controle_mp \
  -d controle_mp_db \
  -c 'UPDATE "tbUsers"
      SET is_deleted = true
      WHERE email = '\''admin@controlemp.local'\'';'
```

Garantir admin real, se ele já existir:

```bash
docker exec -it controle-mp-prod-db psql \
  -U controle_mp \
  -d controle_mp_db \
  -c 'UPDATE "tbUsers"
      SET role_id = 1,
          is_deleted = false
      WHERE email = '\''admin@local.com'\'';'
```

Se o admin não existir, usar `LOCAL_ADMIN_SEED_ENABLED=true` temporariamente ou rodar:

```bash
docker exec -it controle-mp-prod-api sh -lc 'python scripts/ensure_local_admin.py'
```

Depois, por segurança, voltar `LOCAL_ADMIN_SEED_ENABLED=false` se não quiser que a senha seja redefinida a cada restart.

---

# Validações finais após deploy

## Ver containers

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

## Ver logs da API

```bash
docker logs --tail 120 controle-mp-prod-api
```

## Testar front

```bash
curl -I http://127.0.0.1:18088/
curl -I http://127.0.0.1:18088/login
```

## Testar login pela API

```bash
curl -i -m 10 -X POST \
  -H "Content-Type: application/json" \
  http://127.0.0.1:18088/api/auth/login \
  -d '{"email":"admin@local.com","password":"SENHA_CONFIGURADA_NA_ENV"}'
```

## Conferir usuários

```bash
docker exec -it controle-mp-prod-db psql \
  -U controle_mp \
  -d controle_mp_db \
  -c 'SELECT id, full_name, email, role_id, is_deleted FROM "tbUsers" ORDER BY id;'
```

---

# Checklist local

```text
[ ] 003_admin_user.sql está como SELECT 1;
[ ] scripts/ensure_local_admin.py existe
[ ] docker-entrypoint.sh chama ensure_local_admin.py
[ ] .env possui LOCAL_ADMIN_SEED_ENABLED=true
[ ] docker compose down -v foi usado apenas em ambiente local descartável
[ ] API subiu sem checksum divergente
[ ] admin@local.com foi criado com role_id=1
[ ] Login local funcionou
```

---

# Checklist produção

```text
[ ] Backup do banco realizado
[ ] Backup dos uploads realizado
[ ] Nunca usar down -v
[ ] Nunca remover volume do banco
[ ] .env.production revisado
[ ] LOCAL_ADMIN_SEED_ENABLED definido conscientemente
[ ] Se houver checksum divergente, atualizar apenas o checksum do seed alterado após backup
[ ] API recriada sem recriar banco
[ ] Logs sem erro de migrations/seeds
[ ] Usuários preservados
[ ] Login testado
[ ] Admin · Usuários abre sem erro
```

---

## Commit sugerido

```bash
git add \
  api-cadastro-mp/app/database/seeds/003_admin_user.sql \
  api-cadastro-mp/scripts/ensure_local_admin.py \
  api-cadastro-mp/docker-entrypoint.sh

git commit -m "Seed local admin from environment"
```

