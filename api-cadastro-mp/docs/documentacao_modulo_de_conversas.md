# Módulo de Conversas (Conversation)

## Visão Geral

O módulo de **Conversas** é responsável por gerenciar threads de atendimento/solicitação dentro do sistema. Uma conversa representa o contêiner principal onde mensagens, requests e interações futuras serão agrupadas.

Este módulo segue a arquitetura em camadas:

- **Routes (API)**: exposição HTTP (Flask)
- **Service**: regras de negócio e autorização
- **Repository**: acesso a dados (SQLAlchemy)
- **Schemas**: contratos de entrada e saída (Pydantic)
- **Models**: mapeamento ORM

---

## Estrutura de Arquivos

```
app/
├── api/
│   ├── routes/
│   │   └── conversation_routes.py
│   └── schemas/
│       └── conversation_schema.py
├── services/
│   └── conversation_service.py
├── repositories/
│   └── conversation_repository.py
└── infrastructure/
    └── database/
        └── models/
            ├── conversation_model.py
            └── user_model.py
```

---

## Modelo de Dados (ConversationModel)

Tabela: **tbConversations**

### Campos

| Campo        | Tipo        | Descrição |
|--------------|------------|-----------|
| id           | BIGINT     | Identificador da conversa |
| title        | VARCHAR    | Título da conversa |
| created_by   | BIGINT     | Usuário criador |
| assigned_to  | BIGINT     | Usuário responsável (opcional) |
| has_flag     | BOOLEAN    | Flag visual |
| created_at   | TIMESTAMPTZ| Data de criação (preenchida pelo banco) |
| updated_at   | TIMESTAMPTZ| Última atualização |
| is_deleted   | BOOLEAN    | Soft delete |

### Observações importantes

- `created_at` possui `DEFAULT now()` no banco e `server_default=func.now()` no ORM
- `updated_at` é opcional e usada para ordenação por última atividade
- Exclusões são feitas via **soft delete** (`is_deleted = true`)

---

## Schemas (API)

### UserMiniResponse

Representação resumida de usuário (usada em conversas):

```json
{
  "id": 1,
  "full_name": "João Silva",
  "email": "joao@email.com"
}
```

### ConversationResponse

```json
{
  "id": 10,
  "title": "Criar MP",
  "has_flag": false,
  "created_at": "2026-01-16T10:00:00Z",
  "updated_at": null,
  "created_by": { ... },
  "assigned_to": null
}
```

### CreateConversationRequest

```json
{
  "title": "Nova conversa",
  "has_flag": false,
  "assigned_to_id": 5
}
```

### UpdateConversationRequest

```json
{
  "title": "Título atualizado",
  "has_flag": true,
  "assigned_to_id": null
}
```

---

## Regras de Negócio (ConversationService)

### Papéis (Roles)

| Role | Valor | Permissão |
|-----|-------|-----------|
| ADMIN | 1 | Acesso total |
| ANALYST | 2 | Acesso total |
| USER | 3 | Apenas próprias conversas |

### Regras

- **ADMIN / ANALYST**:
  - Listam todas as conversas
  - Podem acessar, editar e excluir qualquer conversa

- **USER**:
  - Lista apenas conversas criadas por ele
  - Só pode acessar, editar e excluir conversas próprias

A validação de acesso é centralizada no service (`_can_access`).

---

## Repository (ConversationRepository)

### Responsabilidades

- Executar queries SQL
- Fazer JOIN com usuários (criador e responsável)
- Não contém regras de autorização

### Ordenação

Todas as listagens utilizam:

```sql
ORDER BY COALESCE(updated_at, created_at) DESC
```

Isso garante ordenação pela **última atividade da conversa**.

### Métodos principais

- `list_all_conversations_rows`
- `list_my_conversations_rows`
- `get_row_by_id`
- `add`
- `update_fields`
- `soft_delete`

Os métodos de listagem e get retornam **tuplas**:

```
(ConversationModel, UserModel creator, UserModel | None assignee)
```

---

## Rotas (Conversation Routes)

Prefixo: `/conversations`

Todas as rotas exigem autenticação (`@require_auth`). O usuário autenticado é obtido via `g.auth`.

### GET /conversations

Lista conversas acessíveis ao usuário.

Query params:
- `limit` (default: 50, máx: 200)
- `offset` (default: 0)

### POST /conversations

Cria uma nova conversa.

- `created_by` é sempre o usuário autenticado
- `created_at` é preenchido automaticamente pelo banco

### GET /conversations/{id}

Obtém uma conversa específica (respeitando regras de acesso).

### PATCH /conversations/{id}

Atualiza campos da conversa:
- title
- has_flag
- assigned_to

Atualizações disparam `updated_at` (via lógica de update).

### DELETE /conversations/{id}

Soft delete da conversa (`is_deleted = true`).

---

## Segurança e Autenticação

- Autenticação via JWT
- Claims usadas:
  - `sub` → user_id
  - `role_id` → papel do usuário

A autorização **não** fica no repository nem na rota, apenas no service.

---

## Considerações Futuras

- Criação da tabela `messages` ligada à conversa
- Campo `last_message_at` para otimizar ordenação
- Contador de mensagens não lidas por usuário
- Atribuição automática para analistas

---

## Resumo

- O módulo segue boas práticas de separação de responsabilidades
- Datas são controladas pelo banco (fonte da verdade)
- Regras de acesso centralizadas no service
- Estrutura preparada para evolução (mensagens, requests, SLA)

Este módulo pode ser usado como referência para outros domínios do sistema.

