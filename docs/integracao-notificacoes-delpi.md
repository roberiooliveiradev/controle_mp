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

## Requisitos para o sino encher

1. `DELPI_NOTIFICATIONS_ENABLED=true` e token Core API corretos na API do Controle MP.
2. **Mesmo e-mail** em `tbUsers` (Controle MP) e em `users` (Minha DELPI / Keycloak).
3. Destinatário com papel **ADMIN** ou **ANALYST** recebe alerta de **nova mensagem** em qualquer conversa (não precisa ter aberto o chat antes).
4. Categoria **Controle MP** não pode estar em `mutedCategories` em `/notifications` → Preferências.
5. `DELPI_PORTAL_CONTROLE_MP_ROUTE` = `basePath` do app no portal (ex.: `/controle_mp`).

Se o e-mail do Controle MP não existir na Core API, o log da API mostra:
`DELPI: e-mail X não encontrado na Minha DELPI`.

## Teste manual

1. Ativar variáveis no `.env` do Controle MP e reiniciar API.
2. Garantir emails iguais nos dois sistemas.
3. Usuário A envia mensagem; usuário B (admin/analista) verifica o sino na **home** da Minha DELPI.
4. Clicar em **Abrir conversa** → deve abrir o Controle MP na conversa correta.

## Ver logs no servidor

```bash
docker logs controle-mp-prod-api 2>&1 | grep -i "DELPI notification"
```

## Referências

- [ARQUITETURA.md](ARQUITETURA.md)
- [Minha DELPI — Notificações](../../delpi-central/docs/04-core-api/notificacoes.md) (repositório `delpi-central`)
