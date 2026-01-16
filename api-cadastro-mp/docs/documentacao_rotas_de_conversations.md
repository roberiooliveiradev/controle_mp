# Módulo de Conversations – Documentação da API

Este documento descreve o **módulo de Conversations**, responsável por gerenciar conversas (threads) que agrupam mensagens, arquivos e requisições no sistema.

A documentação foi elaborada com base nas regras, estrutura e decisões arquiteturais já definidas nos módulos existentes (Conversations + Messages).

---

## Visão Geral

Uma **Conversation** representa o contexto principal de comunicação entre usuários.

Dentro de uma conversa podem existir:
- Mensagens de texto
- Mensagens com arquivos
- Mensagens que originam requisições
- Mensagens do sistema

A conversa funciona como o **container lógico** de tudo que acontece no atendimento.

---

## Controle de Acesso

O acesso às conversas depende do **papel (role)** do usuário autenticado:

| Papel | Permissão |
|------|----------|
| ADMIN | Acesso a todas as conversas |
| ANALYST | Acesso a todas as conversas |
| USER | Apenas conversas criadas por ele |

As regras de autorização são centralizadas no **ConversationService**.

---

## Modelo de Dados

Tabela principal: **tbConversations**

### Campos

| Campo | Tipo | Descrição |
|------|------|-----------|
| id | BIGINT | Identificador da conversa |
| title | VARCHAR(200) | Título da conversa |
| created_by | BIGINT | Usuário que criou a conversa |
| assigned_to | BIGINT | Usuário responsável (opcional) |
| has_flag | BOOLEAN | Indicador visual de destaque |
| created_at | TIMESTAMPTZ | Data de criação |
| updated_at | TIMESTAMPTZ | Última atividade |
| is_deleted | BOOLEAN | Soft delete |

### Observações

- `created_at` é preenchido automaticamente pelo banco
- `updated_at` é atualizado quando ocorre atividade (ex.: nova mensagem)
- Exclusões são feitas via **soft delete**

---

## Ordenação das Conversas

As listagens utilizam a seguinte regra:

```sql
ORDER BY COALESCE(updated_at, created_at) DESC
```

Isso garante que conversas mais recentes ou recentemente atualizadas apareçam primeiro.

---

## Base URL

```
/conversations
```

Todas as rotas exigem autenticação JWT:

```
Authorization: Bearer <TOKEN>
```

---

## 1. Listar conversas

### GET `/conversations`

Lista as conversas acessíveis ao usuário autenticado.

### Query Params
| Nome | Tipo | Default |
|----|----|----|
| limit | int | 50 |
| offset | int | 0 |

### Comportamento
- USER → apenas conversas criadas por ele
- ADMIN / ANALYST → todas as conversas

### Response 200
```json
[
  {
    "id": 1,
    "title": "Solicitação de MP",
    "has_flag": false,
    "created_at": "2026-01-16T09:00:00Z",
    "updated_at": "2026-01-16T10:15:00Z",
    "created_by": {
      "id": 3,
      "full_name": "João Silva",
      "email": "joao@email.com"
    },
    "assigned_to": null
  }
]
```

---

## 2. Criar conversa

### POST `/conversations`

Cria uma nova conversa.

### Request Body
```json
{
  "title": "Nova conversa",
  "has_flag": false,
  "assigned_to_id": null
}
```

### Regras
- `created_by` é sempre o usuário autenticado
- `created_at` é gerado automaticamente

### Response 201
Retorna a conversa criada.

---

## 3. Buscar conversa específica

### GET `/conversations/{conversation_id}`

Retorna os dados de uma conversa específica.

### Possíveis respostas

| Código | Motivo |
|------|-------|
| 200 | Conversa encontrada |
| 403 | Sem permissão |
| 404 | Conversa inexistente |

---

## 4. Atualizar conversa

### PATCH `/conversations/{conversation_id}`

Atualiza campos editáveis da conversa.

### Request Body
```json
{
  "title": "Título atualizado",
  "has_flag": true,
  "assigned_to_id": 5
}
```

### Regras
- USER só pode atualizar conversas próprias
- ADMIN / ANALYST podem atualizar qualquer conversa

### Response 200
Retorna a conversa atualizada.

---

## 5. Excluir conversa (soft delete)

### DELETE `/conversations/{conversation_id}`

Marca a conversa como excluída.

### Regras
- USER só pode excluir conversas próprias
- ADMIN / ANALYST podem excluir qualquer conversa

### Response
- `204 No Content`

---

## Integração com Messages

As **Messages** representam os eventos que ocorrem dentro de uma conversa. Toda mensagem pertence obrigatoriamente a uma Conversation.

### Tipos de Conteúdo de uma Mensagem

Uma mensagem pode conter **um ou mais** dos itens abaixo:

- **Texto** (`body`)
- **Arquivos** (tabela `tbMessageFiles`)
- **Requisição** (`tbRequest` – relação 1:1 com a mensagem)
- **Mensagem de sistema** (`SYSTEM`, criada apenas pelo backend)

A combinação é livre, desde que exista **ao menos um conteúdo válido**.

### Tipos de Mensagem (`tbMessageTypes`)

| id | code | Descrição |
|----|------|-----------|
| 1 | TEXT | Mensagem normal |
| 2 | REQUEST | Mensagem que contém uma solicitação |
| 3 | SYSTEM | Mensagem automática do sistema |

#### Regras
- `REQUEST` sempre cria um registro em `tbRequest`
- `SYSTEM` não pode ser criada via API
- `TEXT` pode conter texto, arquivos ou ambos

### Rotas de Messages

Base URL:

```
/conversations/{conversation_id}/messages
```

Rotas disponíveis:

| Método | Rota | Descrição |
|------|------|-----------|
| GET | `/conversations/{id}/messages` | Lista mensagens da conversa |
| POST | `/conversations/{id}/messages` | Cria nova mensagem |
| GET | `/conversations/{id}/messages/{message_id}` | Busca mensagem específica |
| POST | `/conversations/{id}/messages/read` | Marca mensagens como lidas |
| DELETE | `/conversations/{id}/messages/{message_id}` | Soft delete da mensagem |

### Status de Leitura

O status de leitura **não é armazenado por mensagem**. Em vez disso, é utilizado um ponteiro por usuário:

- Tabela: `tbConversationParticipants`
- Campos:
  - `last_read_message_id`
  - `last_read_at`

#### Regra de leitura

```text
is_read = message.id <= last_read_message_id
```

Esse modelo é mais eficiente e escalável do que read-receipts individuais.

### Impacto nas Conversas

- A criação ou exclusão de mensagens atualiza `tbConversations.updated_at`
- A ordenação das conversas reflete a última atividade (mensagens incluídas)

---


## Erros Comuns

| Código | Descrição |
|------|-----------|
| 401 | Token inválido ou ausente |
| 403 | Acesso negado |
| 404 | Conversa não encontrada |
| 409 | Violação de regra de negócio |

---

## Decisões Arquiteturais

- Separação clara entre Route / Service / Repository
- Autorização concentrada no Service
- Datas controladas pelo banco de dados
- Soft delete em todas as entidades principais
- Estrutura preparada para crescimento (mensagens, requisições, SLA)

---

## Próximos Passos Sugeridos

- Contador de mensagens não lidas por conversa
- Campo materializado `last_message_at`
- Auditoria de ações na conversa
- WebSocket para atualizações em tempo real

## Exemplos de Uso

Os exemplos abaixo ilustram fluxos comuns de uso do módulo de Conversations integrado ao módulo de Messages.

---

### Exemplo 1 – Criar uma conversa e enviar a primeira mensagem

**1. Criar conversa**

```http
POST /conversations
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "title": "Solicitação de MP",
  "has_flag": false
}
```

**Resposta (201)**
```json
{
  "id": 1,
  "title": "Solicitação de MP",
  "created_at": "2026-01-16T09:00:00Z",
  "updated_at": null
}
```

**2. Enviar mensagem de texto**

```http
POST /conversations/1/messages
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message_type_id": 1,
  "body": "Olá, gostaria de solicitar a criação de uma MP."
}
```

---

### Exemplo 2 – Mensagem com arquivos

```http
POST /conversations/1/messages
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message_type_id": 1,
  "files": [
    {
      "original_name": "documento.pdf",
      "stored_name": "uuid-documento.pdf",
      "content_type": "application/pdf",
      "size_bytes": 234567,
      "sha256": "abc123def456"
    }
  ]
}
```

Resultado:
- Mensagem criada
- Registro correspondente em `tbMessageFiles`

---

### Exemplo 3 – Mensagem com requisição

```http
POST /conversations/1/messages
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message_type_id": 2,
  "body": "Solicito a criação de MP para o produto X",
  "create_request": true
}
```

Resultado:
- Mensagem criada com `message_type_id = REQUEST`
- Registro criado em `tbRequest`

---

### Exemplo 4 – Listar mensagens da conversa

```http
GET /conversations/1/messages
Authorization: Bearer <TOKEN>
```

Cada item da resposta inclui:
- `sender`
- `files`
- `request`
- `is_read`

---

### Exemplo 5 – Marcar mensagens como lidas

```http
POST /conversations/1/messages/read
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "message_ids": [1, 2, 3]
}
```

Resultado:
- Atualiza `last_read_message_id` do usuário na conversa
- Mensagens até esse ID passam a retornar `is_read = true`

---

### Exemplo 6 – Fluxo típico de atendimento

1. Usuário cria conversa
2. Usuário envia mensagem inicial
3. Analista responde com mensagem
4. Analista cria mensagem do tipo `REQUEST`
5. Usuário acompanha status via mensagens
6. Conversa permanece ordenada pela última atividade

---

**Este módulo é a base do fluxo de comunicação do sistema e está preparado para uso em produção.**

