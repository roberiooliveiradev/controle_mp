# Frontend – Controle MP

> Documentação técnica detalhada. Para início rápido, veja [README.md](../README.md) e [../../docs/README.md](../../docs/README.md).

## 1. Visão Geral

O frontend do **Controle MP** é uma aplicação **React** criada com **Vite**, responsável por consumir a API Flask do projeto e fornecer a interface para usuários **ADMIN**, **ANALYST** e **USER**.

Principais responsabilidades:
- Autenticação via JWT (access + refresh token) e SSO Minha DELPI (iframe)
- Navegação protegida por login
- Conversas e chat com anexos e criação de solicitações MP
- Fila de solicitações (`/requests`) e catálogo de produtos (`/products`)
- Tempo real via Socket.IO (`RealtimeContext`)
- Administração de usuários e auditoria (ADMIN)
- Multi-perfil no `localStorage`

---

## 2. Stack Utilizada

- **React 19**
- **Vite 7** (build e dev server)
- **Axios** (HTTP client + refresh em 401)
- **React Router DOM 7** (roteamento)
- **socket.io-client 4** (WebSocket)
- **React Context** (`AuthContext`, `RealtimeContext`)
- **LocalStorage** (tokens e perfil ativo)
- **lucide-react**, **react-hot-toast**, **recharts**, **emoji-picker-react**

---

## 3. Estrutura de Pastas

```text
front-cadastro-mp/
├── src/
│   ├── app/
│   │   ├── api/           # authApi, conversationsApi, messagesApi, requestsApi,
│   │   │                  # productsApi, filesApi, auditApi, usersApi, httpClient
│   │   ├── auth/          # AuthContext, authStorage, jwt
│   │   ├── config/env.js
│   │   ├── constants/     # roles, request status/types, message types
│   │   ├── realtime/      # socket.js, RealtimeContext
│   │   ├── routes/        # AppRouter, ProtectedRoute
│   │   ├── sso/           # Bridges Minha DELPI (iframe): SSO, navegação, rota, tema
│   │   └── ui/
│   │       ├── Layout.jsx, Topbar.jsx
│   │       ├── chat/      # ChatComposer, MessageBubble, RequestComposerModal
│   │       ├── conversations/
│   │       ├── requests/  # RequestItemFields, SupplierSearchModal
│   │       └── common/
│   ├── pages/
│   │   ├── LoginPage, RegisterPage
│   │   ├── ConversationsPage
│   │   ├── RequestsPage, ProductsPage
│   │   ├── AccountPage, AdminUsersPage, AuditPage
│   │   └── ConversationDetailPage.jsx  # legado — não usado no router
│   ├── main.jsx
│   └── index.css
├── nginx.conf             # proxy /api e /socket.io (Docker)
├── Dockerfile
└── package.json
```

## 3.1 Rotas (AppRouter)

| Rota | Componente |
|------|------------|
| `/login` | `LoginPage` |
| `/register` | `RegisterPage` |
| `/sso/logout-from-parent` | `LogoutFromParentPage` |
| `/` → `/conversations` | redirect |
| `/conversations`, `/conversations/:id` | `ConversationsPage` |
| `/requests` | `RequestsPage` |
| `/products` | `ProductsPage` |
| `/account` | `AccountPage` |
| `/admin/users` | `AdminUsersPage` |
| `/audit` | `AuditPage` |

---

## 4. Configuração de Ambiente

### `.env`
```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

> O frontend sempre consome a API usando o prefixo `/api`, configurado no Axios.

---

## 5. Comunicação com a API

### `httpClient.js`

- Cria uma instância única do Axios
- Define `baseURL = <VITE_API_BASE_URL>/api`
- Injeta automaticamente o header:

```http
Authorization: Bearer <access_token>
```

- Intercepta erros `401` para limpar a sessão

---

## 6. Autenticação

### Fluxo de Login

1. Usuário envia email e senha
2. Front chama `POST /api/auth/login`
3. Backend retorna:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer"
}
```

4. Front:
- Salva tokens no `localStorage`
- Decodifica o JWT (`sub`, `email`, `role_id`, `full_name`)
- Monta o objeto `user`

---

### `authStorage.js`
Responsável por:
- Persistir tokens e usuário
- Limpar sessão no logout

---

### `jwt.js`
Utilitário simples para:
- Decodificar o payload do JWT
- Extrair informações do usuário

> ⚠️ Não valida assinatura (responsabilidade do backend)

---

### `AuthContext.jsx`

Centraliza o estado de autenticação:

```js
{
  user,
  token,
  isAuthenticated,
  login(),
  logout()
}
```

Qualquer componente pode acessar isso via:

```js
const { user, logout } = useAuth();
```

---

## 7. Roteamento

### `AppRouter.jsx`

Define as rotas da aplicação:

- `/login` → público
- `/conversations` → protegido
- `/conversations/:id` → protegido

---

### `ProtectedRoute.jsx`

- Verifica se o usuário está autenticado
- Redireciona para `/login` caso não esteja

---

## 7.1 Integração iframe — Minha DELPI (`src/app/sso/`)

Montados em `AppRouter.jsx` (sempre ativos; validam `event.origin`).

| Arquivo | Contrato `postMessage` |
|---------|------------------------|
| `DelpiSsoBridge.jsx` | `DELPI_AUTH_READY` → pai; recebe `DELPI_AUTH`, `DELPI_LOGOUT` |
| `DelpiNavigateBridge.jsx` | `DELPI_NAVIGATE` → `navigate(path)` + `delpiEmbeddedNavigation.js` |
| `DelpiRouteSyncBridge.jsx` | envia `DELPI_EMBEDDED_ROUTE` ao mudar rota |
| `DelpiThemeBridge.jsx` | `DELPI_THEME` → `data-theme` / `color-scheme` no `<html>` |
| `delpiParentOrigins.js` | Lista de origens do portal permitidas |
| `delpiTheme.js` | `applyDelpiTheme`, `clearDelpiThemeSync` |

**Tema:** no iframe, o app segue claro/escuro/sistema do menu da Minha DELPI. Fora do iframe, `index.css` usa `prefers-color-scheme` (`:root:not([data-delpi-theme-synced])`).

**SSO:** após login central, não redireciona para `/conversations` se houver rota pendente (`delpi.child.pending_navigate`) ou `DELPI_NAVIGATE`.

Variável: `VITE_DELPI_PARENT_ORIGIN` (origem do portal pai).

---

## 8. Layout

### `Layout.jsx`

Estrutura base da aplicação:
- Topbar fixa
- Conteúdo renderizado via `<Outlet />`

### `Topbar.jsx`

- Exibe nome/email do usuário
- Botão de logout

---

## 9. Páginas

### `LoginPage.jsx`

- Formulário de login
- Exibe erros da API
- Redireciona após sucesso

---

### `ConversationsPage.jsx`

- Lista conversas acessíveis ao usuário
- Consome `GET /api/conversations`

---

### `ConversationDetailPage.jsx`

- Detalhe da conversa
- Lista mensagens
- Preparada para:
  - envio de mensagens
  - marcação como lidas
  - exibição de anexos e requests

---

## 10. APIs do Frontend

### Conversas

```text
GET    /api/conversations
GET    /api/conversations/:id
POST   /api/conversations
PATCH  /api/conversations/:id
DELETE /api/conversations/:id
```

### Mensagens

```text
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages
POST   /api/conversations/:id/messages/read
DELETE /api/conversations/:id/messages/:message_id
```

### Requests

```text
POST   /api/requests
GET    /api/requests/:id
DELETE /api/requests/:id
```

---

## 11. Datas e Timezone

- O backend envia datas em **ISO-8601 com timezone**:

```text
2026-01-16T22:32:56.182720-03:00
```

- No frontend, basta usar:

```js
new Date(created_at).toLocaleString("pt-BR")
```

> Não é necessário ajuste manual de fuso.

---

## 12. Regras de Acesso (RBAC)

- **ADMIN / ANALYST**: veem todas as conversas
- **USER**: vê apenas as próprias

O frontend apenas **exibe** conforme resposta da API.
As regras são aplicadas no backend.

---

## 13. Boas Práticas Adotadas

- Uma única instância de HTTP client
- Autenticação centralizada
- Separação clara entre UI, API e Auth
- Contratos alinhados com schemas do backend
- Timezone tratado corretamente

---

## 14. Próximas Evoluções

- Auto-refresh de token no interceptor
- UI estilo chat
- Upload de arquivos
- Indicador de mensagens não lidas
- Tratamento visual por role

---

## 15. Conclusão

O frontend do **Controle MP** está preparado para crescer sem retrabalho, mantendo:
- clareza arquitetural
- integração estável com a API
- segurança e consistência

📌 Qualquer novo módulo deve seguir o mesmo padrão descrito neste documento.

