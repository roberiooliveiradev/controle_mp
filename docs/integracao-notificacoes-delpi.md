# Integração — Notificações Controle MP ↔ Minha DELPI

> **Tutorial geral (conectar qualquer app iframe na Minha DELPI):** documentação no repositório `delpi-central` → `docs/10-guias-operacionais/conectar-aplicacao-iframe.md`

## Visão geral

Eventos do Controle MP (mensagens, solicitações, conversas) podem gerar notificações no **sino da Minha DELPI**. Ao clicar, o portal abre o app Controle MP no iframe e navega para a tela correta (`DELPI_NAVIGATE`).

## Fluxo

1. API Controle MP processa evento, **faz `commit` no banco** e emite Socket.IO `message:new` (tempo real no chat).
2. Se `DELPI_NOTIFICATIONS_ENABLED=true`, chama `POST {DELPI_CORE_API_URL}/integrations/notifications`.
3. Core API persiste notificação (`category: controle_mp`) para destinatários por **email**.
4. Portal atualiza o sino (socket/polling).
5. Usuário clica → `portal_route` + `metadata.deepPath` → portal navega para `/controle-mp/conversations/{id}`.
6. `AppHost` envia `DELPI_NAVIGATE` ao iframe; o front (`DelpiNavigateBridge`) faz `navigate(deepPath)`.
7. Ao trocar de conversa no iframe, `DelpiRouteSyncBridge` envia `DELPI_EMBEDDED_ROUTE` e a URL do portal acompanha (como no chat IA).

## Configuração

### Controle MP (`.env.production`)

| Variável | Valor em produção |
|----------|-------------------|
| `DELPI_NOTIFICATIONS_ENABLED` | `true` |
| `DELPI_CORE_API_INTERNAL_URL` | `http://host.docker.internal/core-api` (srv-api, preferencial) |
| `DELPI_CORE_API_URL` | `https://minhadelpi.com.br/core-api` (fallback) |
| `CORE_API_INTEGRATIONS_SERVICE_TOKEN` | **Copiar exatamente** de `delpi-central/infra/.env` → `CORE_API_INTEGRATIONS_SERVICE_TOKEN` |
| `DELPI_PORTAL_CONTROLE_MP_ROUTE` | `basePath` do app no portal (ex.: `/controle-mp`) |
| `JWT_SECRET` | Chave **própria** do Controle MP — **não** reutilizar o token de integração |
| `CENTRAL_JWKS_URL` | `https://minhadelpi.com.br/auth/realms/delpi/protocol/openid-connect/certs` |
| `CORS_ORIGINS` | Incluir `https://minhadelpi.com.br` além de `https://controle-mp.minhadelpi.com.br` |

### Minha DELPI (`delpi-central/infra/.env`)

| Variável | Descrição |
|----------|-----------|
| `CORE_API_INTEGRATIONS_SERVICE_TOKEN` | Token mestre; a Core API valida o header `X-Delpi-Service-Token` |
| `PUBLIC_BASE_URL` | `https://minhadelpi.com.br` |
| `VITE_FRONT_CHANNEL_LOGOUT_URLS` | Incluir URL de logout do Controle MP |

Exemplo de alinhamento (mesmo valor nos dois lados):

```env
# delpi-central/infra/.env
CORE_API_INTEGRATIONS_SERVICE_TOKEN=<mesmo valor nos dois lados>

# controle_mp/.env.production
CORE_API_INTEGRATIONS_SERVICE_TOKEN=<mesmo valor nos dois lados>
```

### Minha DELPI (Core API)

- Categoria `controle_mp` já permitida em `notification_constants.py`.
- Token: `CORE_API_INTEGRATIONS_SERVICE_TOKEN` no ambiente da Core API.

### Portal

- Registrar o app Controle MP com `basePath` igual a `DELPI_PORTAL_CONTROLE_MP_ROUTE`.
- `AppHost` e `notificationNavigation` tratam `metadata.source === "controle_mp"`.

## Eventos enviados

| Evento | Destinatários (resumo) | `deepPath` |
|--------|------------------------|------------|
| `message:new` | Participantes, criador e responsável da conversa (exceto remetente) | `/conversations/{id}` |
| `conversation:new` | Analistas/admin (+ responsável se houver) | `/conversations/{id}` |
| `request:created` | Analistas se criador é USER; senão dono da solicitação | `/requests` |
| `request:item_changed` | Regras por papel/status (espelha o front) | `/requests` ou conversa |

Mensagens tipo `REQUEST` não disparam `message:new` no DELPI (evita duplicata com `request:created`).

## Metadados da notificação

O portal trata qualquer notificação com `metadata.deepPath` como deep link de app embedded (não só Controle MP).

```json
{
  "source": "controle_mp",
  "event": "message:new",
  "dedupeKey": "cmp:msg:123",
  "deepPath": "/conversations/12",
  "conversationId": 12
}
```

| Campo | Uso |
|-------|-----|
| `deepPath` | Rota interna no iframe (obrigatório para deep link) |
| `source` | Identificador do app (`controle_mp`) |
| `action.target` | `basePath` no portal (`/controle-mp`) |

## postMessage (iframe)

| Tipo | Direção | Uso |
|------|---------|-----|
| `DELPI_AUTH` | Portal → MP | SSO |
| `DELPI_NAVIGATE` | Portal → MP | Deep link `{ path: "/conversations/109" }` |
| `DELPI_EMBEDDED_ROUTE` | MP → Portal | Sincronizar URL do portal com rota interna |
| `DELPI_AUTH_READY` | MP → Portal | Pedir token |
| `DELPI_LOGOUT` | Portal → MP | Encerrar sessão local |

### URL na barra do navegador

| Onde | Exemplo |
|------|---------|
| Portal (Minha DELPI) | `https://minhadelpi.com.br/controle-mp/conversations/110` |
| Iframe (Controle MP) | `https://controle-mp.minhadelpi.com.br/conversations/110` |

O portal registra apps embedded com rota wildcard (`/controle-mp/*`), no mesmo espírito do chat federado (`/apps/minha-delpi-chat/conversas/:id`).

### Arquivos no front (referência)

| Arquivo | Função |
|---------|--------|
| `front-cadastro-mp/src/app/sso/DelpiSsoBridge.jsx` | SSO Keycloak → sessão local; no iframe **não** força `/conversations` após SSO |
| `front-cadastro-mp/src/app/sso/DelpiNavigateBridge.jsx` | Escuta `DELPI_NAVIGATE` e navega |
| `front-cadastro-mp/src/app/sso/DelpiRouteSyncBridge.jsx` | Envia `DELPI_EMBEDDED_ROUTE` ao mudar rota |
| `front-cadastro-mp/src/app/sso/delpiEmbeddedNavigation.js` | `delpi.child.pending_navigate` (rota pendente após SSO) |
| `front-cadastro-mp/src/pages/ConversationsPage.jsx` | Chat em tempo real (`message:new` + merge de payload) |

Após SSO no iframe, o app aguarda `DELPI_NAVIGATE` ou rota pendente em `sessionStorage` — não redireciona para `/conversations` por padrão.

## Tempo real (Socket.IO)

| Regra | Detalhe |
|-------|---------|
| Ordem na API | `session.commit()` **antes** de `socketio.emit("message:new")` |
| Front receptor | Aplica o payload do socket na UI e depois sincroniza com `GET /messages` (+ retry ~450 ms) |
| Sala | `conversation:{id}` + broadcast global (fallback) |

Ver também: `api-cadastro-mp/docs/documentacao_web_socket_realtime.md`.

### Manifesto no portal (exemplo)

```json
{
  "id": "controle-mp",
  "type": "iframe",
  "basePath": "/controle-mp",
  "entry": "https://controle-mp.minhadelpi.com.br",
  "ui": { "renderMode": "embedded" }
}
```

`DELPI_PORTAL_CONTROLE_MP_ROUTE` e `action.target` nas notificações devem ser **`/controle-mp`** (igual ao `basePath`).

## Preferências do usuário

Usuários podem silenciar a categoria **Controle MP** em `/notifications` → Preferências (`mutedCategories` inclui `controle_mp`).

## Requisitos para o sino encher

1. `DELPI_NOTIFICATIONS_ENABLED=true` e token Core API corretos na API do Controle MP.
2. **Mesmo e-mail** em `tbUsers` (Controle MP) e em `users` (Minha DELPI / Keycloak).
3. Destinatário com papel **ADMIN** ou **ANALYST** recebe alerta de **nova mensagem** em qualquer conversa (não precisa ter aberto o chat antes).
4. Categoria **Controle MP** não pode estar em `mutedCategories` em `/notifications` → Preferências.
5. `DELPI_PORTAL_CONTROLE_MP_ROUTE` = `basePath` do app no portal (ex.: `/controle-mp`, com hífen).

Se o e-mail do Controle MP não existir na Core API, o log da API mostra:
`DELPI: e-mail X não encontrado na Minha DELPI`.

## Teste manual

1. Ativar variáveis no `.env` do Controle MP e reiniciar API + front + portal.
2. Garantir e-mails iguais nos dois sistemas.
3. Usuário A envia mensagem; usuário B (admin/analista) verifica o sino na **home** da Minha DELPI.
4. Clicar em **Abrir conversa** → URL do portal `/controle-mp/conversations/{id}` e chat aberto na conversa correta.
5. Com B na conversa aberta, A envia mensagem → B vê a mensagem **imediatamente** (sem precisar enviar outra).

## Ver logs no servidor

```bash
docker logs controle-mp-prod-api 2>&1 | grep -i "DELPI notification"
```

## Referências

- [ARQUITETURA.md](ARQUITETURA.md)
- [Minha DELPI — Notificações](../../delpi-central/docs/04-core-api/notificacoes.md) (repositório `delpi-central`)
