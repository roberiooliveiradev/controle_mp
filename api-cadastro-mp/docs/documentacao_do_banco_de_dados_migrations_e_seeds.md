# 📚 Documentação – Migrations e Seeds do Banco de Dados

Este documento descreve a finalidade, o conteúdo e a ordem de execução dos arquivos SQL responsáveis pela **criação da estrutura**, **índices** e **dados iniciais (seeds)** do banco de dados do sistema.

A modelagem foi pensada para suportar:
- Conversas e mensagens (chat)
- Requisições em lote (requests)
- Criação e atualização de produtos
- Snapshot do pedido vs. aplicação final
- Histórico e auditoria

---

## 🗂 Estrutura de pastas esperada

```text
database/
├── migrations/
│   ├── 001_create_tables.sql
│   └── 002_add_indexes.sql
└── seeds/
    ├── 001_roles.sql
    └── 002_core_types.sql
```

---

## 1️⃣ `001_create_tables.sql`

### 🎯 Objetivo
Criar **todas as tabelas base** do sistema, incluindo entidades de usuários, conversas, requisições, produtos e auditoria.

Este arquivo **não cria índices de performance avançados** nem dados iniciais — apenas estrutura e FKs.

### 📦 Tabelas criadas

#### Segurança e usuários
- `tbRoles` – Perfis de acesso
- `tbUsers` – Usuários do sistema

#### Conversas (chat)
- `tbConversations` – Conversas/casos
- `tbMessages` – Mensagens da conversa
- `tbMessageFiles` – Arquivos anexados às mensagens

#### Requisições (workflow)
- `tbRequest` – Cabeçalho da requisição (protocolo)
- `tbRequestItem` – Itens da requisição (um por produto)
- `tbRequestItemFields` – Snapshot dos campos enviados pelo usuário

#### Produtos
- `tbProduct` – Produto (estado atual)
- `tbProductFields` – Campos atuais do produto

#### Catálogos
- `tbRequestType` – Tipo da requisição (CREATE, UPDATE)
- `tbRequestStatus` – Status da requisição (IN_PROGRESS, FINALIZED, FAILED)
- `tbFieldType` – Tipo do campo (DEFAULT, OBJECT)

#### Auditoria
- `audit_log` – Log genérico de eventos

### 🔑 Características importantes
- Uso de **soft delete** (`is_deleted`)
- Todas as relações importantes possuem **Foreign Keys**
- Preparado para diferenciar:
  - *o que foi pedido* (request)
  - *o que foi aplicado* (product)

---

## 2️⃣ `002_add_indexes.sql`

### 🎯 Objetivo
Criar **índices de performance e integridade**, sem alterar a estrutura das tabelas.

Este arquivo deve ser executado **após** o `001_create_tables.sql`.

### ⚡ Índices criados

#### Unicidade
- `tbRoles.role_name` – Nome do perfil único
- `tbUsers.email` – Email único

#### Conversas e mensagens
- `tbMessages(conversation_id, created_at)` – Timeline da conversa
- `tbMessages(sender_id)`

#### Requisições
- `tbRequestItem(request_id)` – Buscar itens de uma requisição
- `tbRequestItemFields(request_items_id)` – Buscar campos do item

#### Produtos
- `tbProductFields(product_id, field_tag)` **(UNIQUE parcial)**
  - Garante 1 campo por tag por produto
  - Ignora registros com `is_deleted = TRUE`

#### Snapshot da requisição
- `tbRequestItemFields(request_items_id, field_tag)` **(UNIQUE parcial)**
  - Impede duplicidade de campo no mesmo item

#### Auditoria
- `audit_log(entity_name, entity_id)`
- `audit_log(user_id)`

### 🧠 Observação importante
Os **índices parciais** (`WHERE is_deleted = FALSE`) exigem que as queries no código **sempre filtrem `is_deleted = FALSE`** para que o PostgreSQL consiga utilizá-los.

---

## 3️⃣ `001_roles.sql`

### 🎯 Objetivo
Inserir os **papéis de usuário iniciais** do sistema.

### 📌 Uso
- Define permissões de acesso
- Referenciado por `tbUsers.role_id`

### 🧩 Exemplo de conteúdo
- ADMIN
- USER
- OPERATOR

> Os IDs são fixos para facilitar o uso no código.

---

## 4️⃣ `002_core_types.sql`

### 🎯 Objetivo
Popular tabelas de **catálogo essencial** para o funcionamento do workflow.

### 📦 Dados inseridos

#### `tbRequestType`
Define **o tipo da operação solicitada**:
- `CREATE` (id = 1)
- `UPDATE` (id = 2)

Usado principalmente em `tbRequestItem`.

---

#### `tbRequestStatus`
Define **o ciclo de vida da requisição**:

| ID | Status        | Significado |
|----|---------------|------------|
| 1  | CREATED       | Request criada, nada aplicado |
| 2  | IN_PROGRESS   | Request criada, visualizada |
| 3  | FINALIZED     | Produtos aplicados com sucesso |
| 4  | FAILED        | Erro, nenhuma alteração aplicada |

📌 **Regra de ouro**:
> Somente requests com status **FINALIZED** podem alterar `tbProduct`.

---

#### `tbFieldType`
Define o **tipo lógico do campo**:
- `DEFAULT` – Valor simples
- `OBJECT` – Estrutura complexa (ex.: JSON)

Usado por `tbProductFields` e `tbRequestItemFields`.

---

## 🔄 Ordem correta de execução

```text
1. migrations/001_create_tables.sql
2. migrations/002_add_indexes.sql
3. seeds/001_roles.sql
4. seeds/002_core_types.sql
```

---

## ✅ Conclusão

Com esses arquivos:
- O banco está **normalizado e performático**
- A lógica de **request → finalização → produto** é garantida
- O sistema suporta auditoria, histórico e evolução futura

Este documento deve ser mantido atualizado sempre que novas migrations ou seeds forem adicionadas.

