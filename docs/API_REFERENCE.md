# Referência de API REST — Controle MP

Base URL padrão: `http://<host>:<porta>/api`  
Prefixo opcional: `APP_PREFIX` (ex.: app atrás de subpath no proxy)

Autenticação: `Authorization: Bearer <access_token>` (exceto login, register e health).

---

## Health

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/health` | Não | Liveness |
| GET | `/health/db` | Não | Conexão PostgreSQL |

---

## Auth (`/api/auth`)

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login email/senha → JWT access + refresh |
| POST | `/api/auth/sso-login` | Login com token central (header Bearer Keycloak) |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Revogar tokens |

---

## Users (`/api/users`)

| Método | Path | Auth / Role | Descrição |
|--------|------|-------------|-----------|
| POST | `/api/users` | Público* | Cadastro de usuário |
| GET | `/api/users` | Auth | Listar usuários |
| PUT | `/api/users/<user_id>` | Auth (próprio) | Atualizar perfil (senha atual obrigatória) |
| DELETE | `/api/users/<user_id>` | Auth | Soft delete |
| GET | `/api/users/admin` | Admin (1) | Listagem administrativa |
| PUT | `/api/users/<user_id>/admin` | Admin (1) | Atualizar usuário (role, etc.) |

\* Cadastro público conforme política atual da API.

---

## Conversations (`/api/conversations`)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/conversations` | Listar conversas do usuário |
| GET | `/api/conversations/<id>` | Detalhe |
| GET | `/api/conversations/unread-summary` | Resumo de não lidas |
| POST | `/api/conversations` | Criar conversa |
| PATCH | `/api/conversations/<id>` | Atualizar (título, assignee, flag) |
| DELETE | `/api/conversations/<id>` | Soft delete |

---

## Messages (`/api/conversations/<conversation_id>/messages`)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `.../messages` | Listar mensagens |
| GET | `.../messages/<message_id>` | Detalhe |
| POST | `.../messages` | Enviar (texto, anexos, solicitação embutida) |
| POST | `.../messages/read` | Marcar como lidas |
| DELETE | `.../messages/<message_id>` | Soft delete |

**Tipos de mensagem:** `TEXT` (1), `REQUEST` (2), `SYSTEM` (3).

---

## Files (`/api/files`)

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/files/upload` | Upload multipart (`file` ou `files`) |
| GET | `/api/files/<file_id>/download` | Download de anexo |

---

## Requests (`/api/requests`)

Solicitações de cadastro/alteração de MP.

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/requests` | Criar solicitação (itens + campos) |
| GET | `/api/requests/<request_id>` | Obter solicitação completa |
| DELETE | `/api/requests/<request_id>` | Excluir solicitação |
| POST | `/api/requests/<request_id>/items` | Adicionar item |
| PATCH | `/api/requests/items/<item_id>` | Atualizar item |
| DELETE | `/api/requests/items/<item_id>` | Excluir item |
| PATCH | `/api/requests/items/<item_id>/resubmit` | Reenviar item devolvido |
| POST | `/api/requests/items/<item_id>/fields` | Adicionar campo |
| PATCH | `/api/requests/fields/<field_id>` | Atualizar campo |
| PATCH | `/api/requests/fields/<field_id>/flag` | Marcar flag |
| DELETE | `/api/requests/fields/<field_id>` | Excluir campo |
| GET | `/api/requests/count` | Contagem (topbar/filtros) |
| GET | `/api/requests/items` | Listagem paginada de itens |
| PATCH | `/api/requests/items/<item_id>/status` | Alterar status (pode materializar produto) |
| GET | `/api/requests/meta` | Tipos e status disponíveis |

**Tipos de solicitação:** `CRIAR` (1), `ALTERAR` (2).

**Status de item:** `CRIADO`, `EM PROCESSO`, `FINALIZADO`, `FRACASSADO`, `DEVOLVIDO`, `REJEITADO`.

---

## Products (`/api/products`)

Produtos MP já cadastrados.

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/products` | Listar (filtros: `q`, `flag`, paginação) |
| GET | `/api/products/<product_id>` | Detalhe com campos |
| PATCH | `/api/products/fields/<field_id>/flag` | Flag em campo |
| GET | `/api/products/<product_id>/totvs` | Dados TOTVS do produto |
| GET | `/api/products/totvs/suppliers` | Busca fornecedores no ERP |
| GET | `/api/products/totvs/<product_code>` | Produto no ERP por código |

---

## Audit (`/api/audit`) — Admin

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/audit/logs` | Logs paginados com filtros |
| GET | `/api/audit/summary` | Resumo agregado |

---

## Test (`/test`)

Rotas de desenvolvimento; não usar em produção.

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/test/protected` | Requer autenticação |
| GET | `/test/admin-only` | Requer role admin |

---

## WebSocket (Socket.IO)

Path: `/socket.io` (ou `{APP_PREFIX}/socket.io`)

| Evento (cliente → servidor) | Descrição |
|----------------------------|-----------|
| `connect` | Autenticação via token |
| `conversation:join` | Entrar na sala da conversa |
| `conversation:leave` | Sair da sala |

| Evento (servidor → cliente) | Descrição |
|----------------------------|-----------|
| `message:new` | Nova mensagem |
| `conversation:new` | Nova conversa |
| `request:created` | Nova solicitação |
| `request:item_changed` | Item alterado |
| `product:created` | Produto criado |
| `product:updated` | Produto atualizado |
| `product:flag_changed` | Flag em campo de produto |

Detalhes: [documentacao_web_socket_realtime.md](../api-cadastro-mp/docs/documentacao_web_socket_realtime.md).

---

## Códigos de erro

Erros de domínio retornam JSON com mensagem e HTTP status apropriado (via `AppError` e `register_error_handlers`). Em `DEBUG=true`, stack traces podem aparecer nos logs do servidor.
