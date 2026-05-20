# Guia de desenvolvimento — Controle MP

## Pré-requisitos

| Ferramenta | Versão sugerida |
|------------|-----------------|
| Docker + Compose | v2+ |
| Python | 3.12 |
| Node.js | 20+ |
| npm | 10+ |

Opcional: PostgreSQL local se rodar API fora do Docker.

## Primeira configuração

```bash
git clone <repositorio> controle_mp
cd controle_mp
cp .env.example .env
```

Edite `.env`:

- `POSTGRES_PASSWORD` e `DB_PASSWORD` (mesmo valor)
- `JWT_SECRET` (string longa e aleatória)
- `LOCAL_ADMIN_PASSWORD` (somente desenvolvimento)
- `CORS_ORIGINS` incluindo `http://localhost:5173` se usar Vite dev
- TOTVS: preencha apenas se for testar integração ERP

## Stack Docker (recomendado)

```bash
docker compose -f docker-compose.local.yml --env-file .env up --build -d
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs -f controle-mp-api
```

Parar:

```bash
docker compose -f docker-compose.local.yml down
```

**Reset completo do banco (somente local, apaga dados):**

```bash
docker compose -f docker-compose.local.yml down -v
```

Nunca use `-v` em produção.

## Migrations e seeds

Executadas automaticamente no startup da API quando `RUN_DATABASE_MIGRATIONS_ON_STARTUP=true`.

Manual (dentro do container ou venv local):

```bash
cd api-cadastro-mp
python scripts/run_database_migrations.py status
python scripts/run_database_migrations.py up      # migrations pendentes
python scripts/run_database_migrations.py seed    # seeds pendentes
```

| Comando | Efeito |
|---------|--------|
| `up` | Migrations + seeds |
| `migrate` | Apenas migrations |
| `seed` | Apenas seeds |
| `status` | Lista aplicados/pendentes |
| `baseline` | Marca como aplicado sem executar |
| `reset` | Apaga schema — exige `ALLOW_DATABASE_RESET=true` |

Ordem das migrations:

1. `000_permisions.sql`
2. `001_create_tables.sql`
3. `002_add_indexes.sql`
4. `003_create_revoked_tokens.sql`
5. `004_create_refresh_tokens.sql`

Admin local: `scripts/ensure_local_admin.py` (não usar senha fixa em SQL).

Documentação detalhada: [tutorial_admin_local_e_migrations_controle_mp.md](../api-cadastro-mp/docs/tutorial_admin_local_e_migrations_controle_mp.md).

## Desenvolvimento da API isolada

```bash
cd api-cadastro-mp
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`.env` na pasta da API ou variáveis exportadas — use `DB_HOST=localhost` se Postgres estiver na máquina host (porta `POSTGRES_HOST_PORT`, ex. 5433).

```bash
python scripts/run_database_migrations.py up
export LOCAL_ADMIN_SEED_ENABLED=true
python scripts/ensure_local_admin.py
python -m app.main
```

Produção local com Gunicorn:

```bash
gunicorn "app.main:app" -k eventlet -w 1 -b 0.0.0.0:5000
```

## Desenvolvimento do frontend isolado

```bash
cd front-cadastro-mp
npm install
```

`.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
VITE_API_PREFIX=/api
VITE_SOCKET_PATH=/socket.io
VITE_DELPI_PARENT_ORIGIN=http://localhost:5173
```

```bash
npm run dev    # http://localhost:5173
npm run build
npm run lint
```

## Produção

1. Crie `.env.production` (não commitar)
2. Ajuste `VITE_PROD_*` para URLs públicas
3. Desabilite `LOCAL_ADMIN_SEED_ENABLED` ou use credenciais seguras
4. `DEBUG=false`, `ENVIRONMENT=production`
5. Suba:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

Configure reverse proxy (nginx/traefik) apontando para `127.0.0.1:${FRONT_HOST_PORT}`.

## Testes manuais úteis

| Verificação | Comando / URL |
|-------------|----------------|
| API viva | `curl http://localhost:5000/health` |
| DB | `curl http://localhost:5000/health/db` |
| Login | `POST /api/auth/login` com admin local |
| Front | Abrir `http://localhost:8088` (Docker) ou `:5173` (Vite) |

## Troubleshooting

### CORS no desenvolvimento Vite

Inclua a origem exata do browser em `CORS_ORIGINS` (com porta).

### Socket.IO não conecta

- Dev: `VITE_API_BASE_URL` deve apontar para a API; path `VITE_SOCKET_PATH=/socket.io`
- Docker: front usa proxy nginx — `VITE_API_BASE_URL` vazio no build

### Migrations falham no startup

```bash
docker compose -f docker-compose.local.yml logs controle-mp-api
docker exec -it controle-mp-api python scripts/run_database_migrations.py status
```

### TOTVS indisponível

Endpoints `/api/products/totvs/*` retornam erro; o restante da API funciona. Verifique rede/firewall até `TOTVS_DB_HOST`.

### Upload de arquivos

Volume mapeado: `API_UPLOADS_HOST_PATH` → `FILES_BASE_PATH` no container.

## Convenções de código

**API:** seguir camadas Routes → Services → Repositories; schemas Pydantic nos boundaries.

**Front:** páginas em `pages/`, componentes em `app/ui/`, prefixo CSS `cmp-`.

**Commits:** mensagens em português, foco no propósito da mudança.
