# Arquitetura — Controle MP

## Visão de sistema

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Minha DELPI (iframe pai)                     │
│              postMessage: DELPI_AUTH / DELPI_LOGOUT              │
└────────────────────────────┬────────────────────────────────────┘
                             │ SSO (JWT Keycloak)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              front-cadastro-mp (React + Vite + nginx)            │
│   REST (/api) ──────────────────────► Socket.IO (/socket.io)    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           api-cadastro-mp (Flask + Gunicorn + eventlet)          │
│   Routes → Services → Repositories → SQLAlchemy Models           │
└───────┬─────────────────────────────┬───────────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────┐             ┌───────────────┐
│  PostgreSQL   │             │ TOTVS (opt.)  │
│  (verdade)    │             │ SQL Server    │
└───────────────┘             └───────────────┘
```

## API — Clean Architecture

| Camada | Pasta | Responsabilidade |
|--------|-------|------------------|
| HTTP | `app/api/routes/` | Blueprints Flask, validação Pydantic |
| Schemas | `app/api/schemas/` | DTOs request/response |
| Middleware | `app/api/middlewares/` | Auth JWT, tratamento de erros |
| Serviços | `app/services/` | Regras de negócio, orquestração |
| Repositórios | `app/repositories/` | Acesso a dados |
| Infraestrutura | `app/infrastructure/` | DB, JWT, storage, Socket.IO |
| Entidades | `app/entities/` | POCOs de domínio |
| Core | `app/core/` | Exceções, bases, interfaces de notifiers |

**Padrões transversais:**

- Soft delete (`is_deleted`) nas entidades principais
- `AuditService` em mutações sensíveis
- Notifiers Socket.IO desacoplados via interfaces em `core/interfaces/`

## Frontend — organização

| Área | Pasta | Papel |
|------|-------|-------|
| Páginas | `src/pages/` | Telas e orquestração de estado |
| UI | `src/app/ui/` | Componentes reutilizáveis + CSS co-localizado |
| API clients | `src/app/api/` | Módulos Axios por domínio |
| Auth | `src/app/auth/` | Context, storage multi-perfil, decode JWT |
| Realtime | `src/app/realtime/` | Socket.IO + `RealtimeContext` |
| SSO | `src/app/sso/` | Bridge com iframe Minha DELPI |
| Config | `src/app/config/env.js` | Variáveis `VITE_*` |

**Estado:** React Context (`AuthContext`, `RealtimeContext`) + `localStorage` — sem Redux.

## Autenticação

### Login local

1. `POST /api/auth/login` → par access + refresh JWT (HS256)
2. Access token em `Authorization: Bearer` nas requisições
3. Refresh automático no interceptor Axios em 401
4. Revogação em logout (`tbRevokedTokens`, `tbRefreshTokens`)

### SSO Minha DELPI

1. App embutido em iframe recebe token central via `postMessage`
2. `POST /api/auth/sso-login` valida RS256 via JWKS (`CENTRAL_JWKS_URL`)
3. Emite sessão local JWT; role padrão: `CENTRAL_DEFAULT_ROLE_ID` (USER)

## Tempo real (Socket.IO)

- Path: `{APP_PREFIX}/socket.io`
- Autenticação no `connect` via token JWT
- Salas por conversa: `conversation:join` / `conversation:leave`

**Eventos emitidos pelo servidor (exemplos):**

| Evento | Uso |
|--------|-----|
| `message:new` | Nova mensagem na conversa |
| `conversation:new` | Nova conversa |
| `request:created` | Nova solicitação |
| `request:item_changed` | Item/status alterado |
| `product:created` / `product:updated` / `product:flag_changed` | Catálogo MP |

## Modelo de dados (PostgreSQL)

Entidades principais:

| Tabela | Conceito |
|--------|----------|
| `tbUsers`, `tbRoles` | Usuários e papéis |
| `tbConversations`, `tbConversationParticipants` | Canais de chat |
| `tbMessages`, `tbMessageTypes` | TEXT, REQUEST, SYSTEM |
| `tbRequest`, `tbRequestItem`, `tbRequestItemFields` | Solicitações de MP |
| `tbProduct`, `tbProductFields` | Produtos cadastrados |
| `tbFieldType` | Tipos de campo (DEFAULT, OBJECT) |
| `audit_log` | Auditoria |
| `tbSchemaMigrations` | Controle de migrations/seeds SQL |

Migrations: SQL versionado em `app/database/migrations/`, executado por `scripts/run_database_migrations.py` (não é Alembic).

## Integração TOTVS

- Conexão opcional via `pyodbc` (SQL Server)
- Leitura de produtos (`SB1010`) e fornecedores (`SA5010`)
- API **sobe normalmente** sem variáveis TOTVS configuradas
- Endpoints: `/api/products/totvs/...`

## Deploy com Docker

### Local (`docker-compose.local.yml`)

- Postgres exposto na porta host configurável
- API com volume de uploads
- Front com nginx fazendo **proxy reverso** de `/api/` e `/socket.io/` para `controle-mp-api:5000`
- Por isso `VITE_API_BASE_URL` pode ficar vazio no build Docker (mesma origem)

### Produção (`docker-compose.prod.yml`)

- `.env.production` separado
- Front bind apenas em `127.0.0.1` para reverse proxy externo
- `restart: unless-stopped`
- `extra_hosts: host.docker.internal` na API (acesso a serviços no host, ex. TOTVS)

## Segurança

- Senhas com hash + salt na aplicação (`PasswordHasher`)
- RBAC por `role_id` (`@require_roles`)
- Upload com whitelist de MIME e limite de tamanho
- CORS configurável via `CORS_ORIGINS`
- Arquivos em disco local (`FILES_BASE_PATH`), não versionados

## Relação com Minha DELPI

O Controle MP pode rodar:

1. **Standalone** — login em `/login`
2. **Embutido** — iframe na central DELPI com SSO via `DelpiSsoBridge` e `VITE_DELPI_PARENT_ORIGIN`

Variáveis SSO: `CENTRAL_JWKS_URL`, `CENTRAL_JWT_ISSUER`, `CENTRAL_JWT_AUDIENCE`.
