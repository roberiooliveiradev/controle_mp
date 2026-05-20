# API Cadastro MP (Controle MP)

API REST e WebSocket do sistema **Controle MP** — cadastro e fluxo de matérias-primas com chat, solicitações, produtos, auditoria e integração opcional TOTVS / SSO Minha DELPI.

## Stack

- Python 3.12, Flask 3, Pydantic v2
- PostgreSQL (SQLAlchemy 2)
- JWT (access + refresh) + SSO Keycloak (JWKS)
- Flask-SocketIO + eventlet
- Gunicorn (produção)

## Estrutura

```text
api-cadastro-mp/
├── app/
│   ├── main.py                 # Factory Flask + Socket.IO
│   ├── api/routes/             # Blueprints HTTP
│   ├── api/schemas/            # DTOs Pydantic
│   ├── api/middlewares/        # Auth, erros
│   ├── services/               # Regras de negócio
│   ├── repositories/           # Acesso a dados
│   ├── infrastructure/         # DB, JWT, storage, realtime
│   ├── entities/               # POCOs
│   └── database/
│       ├── migrations/         # SQL versionado
│       └── seeds/
├── scripts/
│   ├── run_database_migrations.py
│   └── ensure_local_admin.py
├── docs/                       # Documentação por módulo
├── Dockerfile
├── docker-entrypoint.sh
└── requirements.txt
```

## Execução local

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Configure DB_* (ver .env.example na raiz do monorepo)
python scripts/run_database_migrations.py up
python -m app.main
```

Porta padrão: `5000` (`API_CONTAINER_PORT`).

## Docker (monorepo)

Na raiz `controle_mp/`:

```bash
docker compose -f docker-compose.local.yml up --build controle-mp-api
```

O entrypoint executa migrations (se configurado) e inicia Gunicorn com worker `eventlet`.

## Migrations

```bash
python scripts/run_database_migrations.py status
python scripts/run_database_migrations.py up
```

Ver [docs/documentacao_do_banco_de_dados_migrations_e_seeds.md](docs/documentacao_do_banco_de_dados_migrations_e_seeds.md) e [docs/tutorial_admin_local_e_migrations_controle_mp.md](docs/tutorial_admin_local_e_migrations_controle_mp.md).

## Documentação

| Documento | Tema |
|-----------|------|
| [docs/estrutura_do_projeto_cadastro_mp.md](docs/estrutura_do_projeto_cadastro_mp.md) | Pastas e Clean Architecture |
| [docs/documentacao_modulo_de_usuarios_e_autenticacao.md](docs/documentacao_modulo_de_usuarios_e_autenticacao.md) | Auth JWT e SSO |
| [docs/documentacao_modulo_de_requests.md](docs/documentacao_modulo_de_requests.md) | Solicitações MP |
| [docs/documentacao_web_socket_realtime.md](docs/documentacao_web_socket_realtime.md) | Socket.IO |
| [../docs/API_REFERENCE.md](../docs/API_REFERENCE.md) | Referência REST consolidada |

Índice geral: [../docs/README.md](../docs/README.md).

## Variáveis de ambiente

Use o [.env.example](../.env.example) na raiz do monorepo. Principais grupos:

- `DB_*` — PostgreSQL
- `JWT_*` — tokens locais
- `CENTRAL_*` — SSO Minha DELPI
- `TOTVS_DB_*` — ERP (opcional)
- `FILES_*` — uploads locais
- `RUN_DATABASE_MIGRATIONS_ON_STARTUP`, `LOCAL_ADMIN_*`

## Health

- `GET /health`
- `GET /health/db`
