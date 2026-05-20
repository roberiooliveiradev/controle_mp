# Integração — Notificações Controle MP ↔ Minha DELPI

## Visão geral

Eventos do Controle MP (mensagens, solicitações, conversas) podem gerar notificações no **sino da Minha DELPI**. Ao clicar, o portal abre o app Controle MP no iframe e navega para a tela correta (`DELPI_NAVIGATE`).

## Fluxo

1. API Controle MP processa evento e emite Socket.IO (como antes).
2. Se `DELPI_NOTIFICATIONS_ENABLED=true`, chama `POST {DELPI_CORE_API_URL}/integrations/notifications`.
3. Core API persiste notificação (`category: controle_mp`) para destinatários por **email**.
4. Portal atualiza o sino (socket/polling).
5. Usuário clica → `portal_route` + `metadata.deepPath` → `AppHost` envia `DELPI_NAVIGATE` ao iframe.
6. Front Controle MP (`DelpiNavigateBridge`) faz `navigate(deepPath)`.

## Configuração

### Controle MP (`.env`)

| Variável | Descrição |
|----------|-----------|
| `DELPI_NOTIFICATIONS_ENABLED` | `true` para ativar envio |
| `DELPI_CORE_API_URL` | Base da Core API, ex.: `https://minhadelpi.com.br/core-api` |
| `CORE_API_INTEGRATIONS_SERVICE_TOKEN` | Mesmo token configurado na Core API |
| `DELPI_PORTAL_CONTROLE_MP_ROUTE` | Rota do app no portal, ex.: `/apps/controle-mp` |

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

```json
{
  "source": "controle_mp",
  "event": "message:new",
  "dedupeKey": "cmp:msg:123",
  "deepPath": "/conversations/12",
  "conversationId": 12
}
```

## postMessage (iframe)

| Tipo | Direção | Uso |
|------|---------|-----|
| `DELPI_AUTH` | Portal → MP | SSO |
| `DELPI_NAVIGATE` | Portal → MP | Deep link `{ path: "/conversations/1" }` |
| `DELPI_AUTH_READY` | MP → Portal | Pedir token |

## Preferências do usuário

Usuários podem silenciar a categoria **Controle MP** em `/notifications` → Preferências (`mutedCategories` inclui `controle_mp`).

## Teste manual

1. Ativar variáveis no `.env` do Controle MP e reiniciar API.
2. Garantir emails iguais nos dois sistemas.
3. Enviar mensagem entre dois usuários.
4. Verificar sino na Minha DELPI.
5. Clicar em **Abrir conversa** → deve abrir a conversa correta.

## Referências

- [ARQUITETURA.md](ARQUITETURA.md)
- [Minha DELPI — Notificações](../../delpi-central/docs/04-core-api/notificacoes.md) (repositório `delpi-central`)
