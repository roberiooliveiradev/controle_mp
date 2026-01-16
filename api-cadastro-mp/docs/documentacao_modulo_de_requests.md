# Módulo de Requests – Documentação da API

Este documento descreve o módulo de **Requests** (solicitações), incluindo:

- Estrutura de dados (`tbRequest`, `tbRequestItem`, `tbRequestItemFields`)
- Integração com **Messages** e **Conversations**
- Controle de acesso por role (ADMIN/ANALYST/USER)
- Rotas (CRUD completo)
- Regras de negócio e validações
- Exemplos de uso (HTTP)

> Observação: alguns arquivos antigos do projeto podem expirar do lado do assistente ao longo do tempo. Esta documentação foi escrita com base no esquema SQL fornecido por você e no padrão já consolidado nos módulos de Conversations/Messages.

---

## Visão Geral

Uma **Request** representa uma solicitação formal dentro do sistema.

- Uma Request é **criada a partir de uma Message** (mensagem do tipo `REQUEST`).
- Uma Request contém um ou mais **RequestItems**.
- Cada RequestItem contém um ou mais **RequestItemFields**, que são campos dinâmicos (tag/valor/flag) para permitir flexibilidade.

### Relações

```
Conversation (tbConversations)
  └── Message (tbMessages)
        └── Request (tbRequest)           [1:1 por message_id]
              └── RequestItem (tbRequestItem)        [1:N]
                    └── RequestItemFields (tbRequestItemFields)  [1:N]
```

---

## Controle de Acesso

O acesso a Requests é **herdado da Conversation** associada à Message.

Ou seja:

- Para acessar uma Request, o usuário precisa ter acesso à Conversation da Message vinculada.

### Papéis

| Papel | Acesso |
|------|--------|
| ADMIN | Acesso total |
| ANALYST | Acesso total |
| USER | Apenas conversas criadas por ele (e, portanto, suas requests) |

---

## Tipos e Status

Essas tabelas dão significado aos itens e ao workflow:

- `tbRequestType` → tipo do item
- `tbRequestStatus` → status do item
- `tbFieldType` → tipo do campo (opcional, para padronizar)

O módulo de Requests **não valida semanticamente** o conteúdo de cada campo (isso fica para regras futuras), mas valida:
- existência de ids obrigatórios
- consistência estrutural (itens/fields)

---

## Modelo de Dados

### 1) `tbRequest`

| Campo | Tipo | Descrição |
|------|------|-----------|
| id | BIGSERIAL | PK |
| message_id | BIGINT | FK para `tbMessages.id` (UNIQUE) |
| created_by | BIGINT | FK para `tbUsers.id` |
| created_at | TIMESTAMPTZ | Default `now()` |
| updated_at | TIMESTAMPTZ | Atualizações |
| is_deleted | BOOLEAN | Soft delete |

**Regras**
- `message_id` é **único**: uma mensagem cria no máximo 1 request.

### 2) `tbRequestItem`

| Campo | Tipo | Descrição |
|------|------|-----------|
| id | BIGSERIAL | PK |
| request_id | BIGINT | FK para `tbRequest.id` |
| product_id | BIGINT | FK para `tbProduct.id` (opcional) |
| request_type_id | BIGINT | FK para `tbRequestType.id` |
| request_status_id | BIGINT | FK para `tbRequestStatus.id` |
| created_at | TIMESTAMPTZ | Default `now()` |
| updated_at | TIMESTAMPTZ | Atualizações |
| is_deleted | BOOLEAN | Soft delete |

### 3) `tbRequestItemFields`

| Campo | Tipo | Descrição |
|------|------|-----------|
| id | BIGSERIAL | PK |
| request_items_id | BIGINT | FK para `tbRequestItem.id` |
| field_type_id | BIGINT | FK para `tbFieldType.id` |
| field_tag | VARCHAR(255) | Nome do campo |
| field_value | TEXT | Valor (opcional) |
| field_flag | TEXT | Flag/observação (opcional) |
| created_at | TIMESTAMPTZ | Default `now()` |
| updated_at | TIMESTAMPTZ | Atualizações |
| is_deleted | BOOLEAN | Soft delete |

---

## Rotas da API (CRUD Completo)

Base URL (sugestão):

```
/requests
```

Todas as rotas exigem autenticação:

```
Authorization: Bearer <TOKEN>
```

---

## 1. Criar Request

### POST `/requests`

Cria uma request vinculada a uma message e já cria itens e fields iniciais.

### Request Body

```json
{
  "message_id": 123,
  "items": [
    {
      "request_type_id": 1,
      "request_status_id": 1,
      "product_id": null,
      "fields": [
        {
          "field_type_id": 1,
          "field_tag": "Produto",
          "field_value": "X",
          "field_flag": null
        }
      ]
    }
  ]
}
```

### Regras
- `items` deve ter ao menos 1 item
- se já existir request para `message_id`, retorna erro

### Response 201
Retorna a request completa, incluindo items e fields.

---

## 2. Buscar Request

### GET `/requests/{request_id}`

Retorna uma request completa com items e fields.

### Response 200
```json
{
  "id": 10,
  "message_id": 123,
  "created_by": 3,
  "created_at": "2026-01-16T10:00:00Z",
  "updated_at": null,
  "items": [
    {
      "id": 99,
      "request_id": 10,
      "request_type_id": 1,
      "request_status_id": 1,
      "product_id": null,
      "created_at": "2026-01-16T10:00:00Z",
      "updated_at": null,
      "fields": [
        {
          "id": 500,
          "request_items_id": 99,
          "field_type_id": 1,
          "field_tag": "Produto",
          "field_value": "X",
          "field_flag": null,
          "created_at": "2026-01-16T10:00:00Z",
          "updated_at": null
        }
      ]
    }
  ]
}
```

---

## 3. Deletar Request (soft delete)

### DELETE `/requests/{request_id}`

Marca a request como excluída.

### Response
- `204 No Content`

> Sugestão: opcionalmente fazer soft delete em cascata lógica (items/fields).

---

## 4. Adicionar Item

### POST `/requests/{request_id}/items`

Cria um novo item para a request.

### Request Body
```json
{
  "request_type_id": 2,
  "request_status_id": 1,
  "product_id": 55,
  "fields": []
}
```

### Response 201
```json
{ "id": 120 }
```

---

## 5. Atualizar Item

### PATCH `/requests/items/{item_id}`

Atualiza campos do item, como status.

### Request Body
```json
{
  "request_status_id": 2
}
```

### Response
- `204 No Content`

---

## 6. Deletar Item (soft delete)

### DELETE `/requests/items/{item_id}`

### Response
- `204 No Content`

---

## 7. Adicionar Field em um Item

### POST `/requests/items/{item_id}/fields`

### Request Body
```json
{
  "field_type_id": 1,
  "field_tag": "Observação",
  "field_value": "Urgente",
  "field_flag": null
}
```

### Response 201
```json
{ "id": 800 }
```

---

## 8. Atualizar Field

### PATCH `/requests/fields/{field_id}`

### Request Body
```json
{
  "field_value": "Alterado"
}
```

### Response
- `204 No Content`

---

## 9. Deletar Field (soft delete)

### DELETE `/requests/fields/{field_id}`

### Response
- `204 No Content`

---

## Erros Comuns

| Código | Descrição |
|------|-----------|
| 401 | Token inválido ou ausente |
| 403 | Acesso negado pela conversa |
| 404 | Request/Item/Field não encontrado |
| 409 | Request já existe para a message ou violação de regra |

---

## Integração com Messages

### Criação de Request via Message

Fluxo recomendado:

1. Criar Message do tipo `REQUEST`:

```http
POST /conversations/{conversation_id}/messages
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message_type_id": 2,
  "body": "Solicito MP",
  "create_request": true
}
```

2. A API cria um registro em `tbRequest` ligado à `message_id`.

3. Em seguida, o frontend cria itens/fields via `/requests`.

---

## Decisões Arquiteturais

- Regras de permissão ficam no **RequestService**
- Repositories fazem apenas queries
- Soft delete em todas as entidades
- Estrutura flexível via fields dinâmicos
- Evolução prevista para status, auditoria e SLA

---

## Soft delete em cascata lógica

Por padrão, o projeto utiliza **soft delete** (`is_deleted = true`) em todas as entidades principais.

Ao excluir uma **Request**, recomenda-se aplicar **soft delete em cascata lógica** para manter consistência do grafo de dados:

- `tbRequest` (pai)
- `tbRequestItem` (filhos)
- `tbRequestItemFields` (netos)

### Objetivo

Evitar que uma Request marcada como deletada continue com itens/campos ativos (ou vice-versa).

### Implementação recomendada (Service)

A implementação preferida é no **RequestService.delete_request()**, executando em uma única transação:

1. Validar acesso do usuário (por Conversation via Message)
2. Marcar **fields** como deletados (por request_id)
3. Marcar **items** como deletados (por request_id)
4. Marcar a **request** como deletada (por request_id)

#### Exemplo de lógica (pseudocódigo)

```text
if request existe e user tem acesso:
    soft_delete(fields where item.request_id = request_id)
    soft_delete(items where request_id = request_id)
    soft_delete(request where id = request_id)
```

### Métodos de repository (bulk)

- `RequestItemFieldRepository.soft_delete_by_request_id(request_id) -> int`
- `RequestItemRepository.soft_delete_by_request_id(request_id) -> int`

Esses métodos devem fazer `UPDATE ... SET is_deleted = true, updated_at = now()` em lote.

### Alternativa (blindagem no banco)

Como reforço (opcional), pode ser criado um **trigger no PostgreSQL** que, ao detectar `tbRequest.is_deleted` passando de `false` para `true`, propaga o soft delete para `tbRequestItem` e `tbRequestItemFields`.

Essa abordagem é útil quando existe risco de atualização direta no banco fora da aplicação.

### Recomendações de performance

Criar índices para acelerar o cascade:

- `tbRequestItem(request_id)`
- `tbRequestItemFields(request_items_id)`

Preferencialmente com filtro:

```sql
... WHERE is_deleted = FALSE
```

---

## Próximos Passos Sugeridos

- Soft delete em cascata lógica ao deletar Request (✅ documentado)
- Endpoint para listar requests por conversa
- Auditoria de mudanças de status
- Validações por tipo (request_type/field_type)

---

**Este módulo está preparado para suportar requisições complexas com múltiplos itens e campos dinâmicos.**

