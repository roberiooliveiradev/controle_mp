# Frontend — Controle MP

SPA **React 19** + **Vite 7** para o sistema de cadastro e fluxo de matérias-primas (MP): conversas, solicitações, produtos, conta, admin e auditoria.

## Stack

- React 19, React Router DOM 7
- Axios (HTTP + refresh automático)
- socket.io-client (tempo real)
- lucide-react, react-hot-toast, recharts

## Rotas

| Rota | Página | Acesso |
|------|--------|--------|
| `/login` | Login | Público |
| `/register` | Cadastro | Público |
| `/sso/logout-from-parent` | Logout SSO | Público |
| `/conversations` | Lista de conversas | Autenticado |
| `/conversations/:id` | Chat | Autenticado |
| `/requests` | Fila de solicitações MP | Autenticado |
| `/products` | Catálogo de produtos | Autenticado |
| `/account` | Minha conta | Autenticado |
| `/admin/users` | Gestão de usuários | Admin |
| `/audit` | Auditoria | Admin |

Redirecionamento padrão: `/` → `/conversations`.

## Execução local

```bash
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
npm run dev      # http://localhost:5173
npm run build
npm run preview
npm run lint
```

A API deve estar rodando e com `CORS_ORIGINS` incluindo a origem do Vite.

## Docker (monorepo)

Build com args `VITE_*` definidos no `docker-compose`. O **nginx** do container faz proxy de `/api/` e `/socket.io/` para a API — em produção Docker, `VITE_API_BASE_URL` pode ficar vazio (mesma origem).

```bash
# Na raiz controle_mp/
docker compose -f docker-compose.local.yml up --build controle-mp-front
```

Acesso: `http://localhost:${FRONT_HOST_PORT}` (padrão `8088`).

## Estrutura do código

```text
src/
├── pages/              # Telas (rotas)
├── app/
│   ├── api/            # Clientes REST
│   ├── auth/           # AuthContext, storage, JWT
│   ├── config/env.js   # VITE_*
│   ├── realtime/       # Socket + RealtimeContext
│   ├── routes/         # AppRouter, ProtectedRoute
│   ├── sso/            # DelpiSsoBridge (iframe DELPI)
│   └── ui/             # Layout, chat, requests, common
├── main.jsx
└── index.css
```

## SSO Minha DELPI

Quando embutido em iframe:

1. `DelpiSsoBridge` envia `DELPI_AUTH_READY` ao pai
2. Recebe `DELPI_AUTH` com token via `postMessage`
3. Chama `POST /api/auth/sso-login`

Configure `VITE_DELPI_PARENT_ORIGIN` com a origem exata do portal pai.

## Documentação detalhada

[docs/documentacao_do_frontend_controle_mp.md](docs/documentacao_do_frontend_controle_mp.md)

Índice geral do monorepo: [../docs/README.md](../docs/README.md).
