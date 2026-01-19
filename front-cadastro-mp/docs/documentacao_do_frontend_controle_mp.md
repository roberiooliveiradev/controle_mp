# Frontend – Controle MP

## 1. Visão Geral

O frontend do **Controle MP** é uma aplicação **React** criada com **Vite**, responsável por consumir a API Flask do projeto e fornecer a interface para usuários **ADMIN**, **ANALYST** e **USER**.

Principais responsabilidades:
- Autenticação via JWT (access + refresh token)
- Navegação protegida por login
- Listagem e gerenciamento de conversas
- Visualização e envio de mensagens
- Integração com Requests (solicitações)
- Exibição correta de datas com timezone

---

## 2. Stack Utilizada

- **React 18**
- **Vite** (build e dev server)
- **Axios** (HTTP client)
- **React Router DOM** (roteamento)
- **LocalStorage** (persistência de sessão)

---

## 3. Estrutura de Pastas

```text
front-cadastro-mp/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── httpClient.js
│   │   │   ├── authApi.js
│   │   │   ├── conversationsApi.js
│   │   │   ├── messagesApi.js
│   │   │   └── requestsApi.js
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── authStorage.js
│   │   │   └── jwt.js
│   │   ├── routes/
│   │   │   ├── AppRouter.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── ui/
│   │   │   ├── Layout.jsx
│   │   │   └── Topbar.jsx
│   │   └── config/
│   │       └── env.js
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── ConversationsPage.jsx
│   │   └── ConversationDetailPage.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
└── .env
```

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

