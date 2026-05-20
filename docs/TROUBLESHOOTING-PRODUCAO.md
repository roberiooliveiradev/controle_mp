# Troubleshooting — produção Controle MP

## Sintoma: UI abre, mas tudo fica em “Carregando…” e Network mostra 401

As rotas do React (`/conversations`, `/admin/users`, etc.) **não estão quebradas**. O frontend carrega, porém a **API rejeita o token** (`401 Unauthorized` em `/api/conversations`, `/api/users/admin`, `/auth/refresh`).

### Causa mais comum: `JWT_SECRET` alterado

Se o `.env.production` mudou `JWT_SECRET` (ex.: de `uma_chave_bem_grande_e_secreta` para `troque-por-uma-chave-forte`):

- Tokens no **localStorage** do navegador foram assinados com a chave antiga.
- A API valida com a chave nova → **access e refresh inválidos**.
- O topo ainda mostra o nome do usuário (leitura local do JWT **sem validar assinatura**).

**Correção (escolha uma):**

1. **Recomendado após migração:** peça aos usuários para limpar dados do site ou abrir aba anônima e fazer **login de novo** (`/login`).
2. **Sem forçar re-login:** volte `JWT_SECRET` no `.env.production` para o **mesmo valor** usado quando o banco/ dump foi gerado e reinicie a API:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production restart controle-mp-api
   ```

### Causa 2: dump restaurado sem alinhar refresh tokens

Após restaurar PostgreSQL, a tabela `tbRefreshTokens` pode não bater com o que está no navegador. Solução: **novo login**.

### Causa 3: SSO (`sso-login` 500 ou 401) após mudar `.env.production`

No **srv-api**, o iframe na Minha DELPI costuma funcionar com JWKS via **host do Docker** (nginx do host na porta 80):

```env
CENTRAL_JWKS_URL=http://host.docker.internal/auth/realms/delpi/protocol/openid-connect/certs
CENTRAL_JWT_ISSUER=https://minhadelpi.com.br/auth/realms/delpi
CENTRAL_JWT_AUDIENCE=delpi-central
```

Trocar só para URL HTTPS pública (`https://minhadelpi.com.br/auth/.../certs`) pode quebrar o SSO: alguns proxies retornam **403** para o User-Agent `Python-urllib` (usado pelo PyJWT ao buscar JWKS). O sintoma era `500 Internal server error` no `sso-login`. A API agora envia um User-Agent próprio; mesmo assim, no srv-api costuma ser mais estável usar `host.docker.internal`.

**Diagnóstico:**

```bash
docker exec controle-mp-prod-api python -c "
import urllib.request
for u in [
  'http://host.docker.internal/auth/realms/delpi/protocol/openid-connect/certs',
  'https://minhadelpi.com.br/auth/realms/delpi/protocol/openid-connect/certs',
]:
  try:
    r = urllib.request.urlopen(u, timeout=8)
    print(u, '->', r.status)
  except Exception as e:
    print(u, '-> ERRO', e)
"

docker logs controle-mp-prod-api 2>&1 | tail -50
```

**Correção:** alinhe `CENTRAL_JWKS_URL` ao que o `docker exec` acima conseguir abrir, reinicie a API e teste o iframe em aba anônima.

Login direto em `https://controle-mp.minhadelpi.com.br/login` (email/senha local) **não** depende do JWKS.

---

## Notificações não aparecem no sino da Minha DELPI

1. Confirme na API: `DELPI_NOTIFICATIONS_ENABLED=true` e `CORE_API_INTEGRATIONS_SERVICE_TOKEN` igual ao `infra/.env` do delpi-central.
2. No **srv-api**, use URL interna para a Core API (evita bloqueio do proxy no `urllib` do container):
   ```env
   DELPI_CORE_API_INTERNAL_URL=http://host.docker.internal/core-api
   DELPI_CORE_API_URL=https://minhadelpi.com.br/core-api
   ```
3. O e-mail do destinatário no Controle MP (`tbUsers`) deve ser **o mesmo** do Keycloak na Minha DELPI.
4. Quem **envia** a mensagem **não** recebe notificação — teste logado como **admin/analista** na Minha DELPI enquanto um **USER** envia no chat.
5. Categoria **Controle MP** não pode estar silenciada em `/notifications` → Preferências.
6. Logs: `docker logs controle-mp-prod-api 2>&1 | grep -i DELPI`
7. `DELPI_PORTAL_CONTROLE_MP_ROUTE` = `basePath` real (ex. `/controle-mp`).

## Notificação abre o app mas não a conversa (deep link)

1. Confirme `metadata.deepPath` na notificação (ex.: `/conversations/109`).
2. `action.target` e manifesto `basePath` devem ser iguais (`/controle-mp`).
3. Rebuild **portal** (delpi-central) e **front** Controle MP (bridges SSO + `DelpiNavigateBridge`).
4. Tutorial completo: `delpi-central/docs/10-guias-operacionais/conectar-aplicacao-iframe.md`.

A URL do portal permanece `/controle-mp`; a conversa abre dentro do iframe.

## Mensagem enviada só aparece ao mandar a próxima

Corrige com rebuild do **front** (corrida entre socket `message:new` e mensagem otimista). Atualize o código e:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build controle-mp-front controle-mp-api
```

---

## Checklist rápido no servidor

```bash
# API responde?
curl -sS https://controle-mp.minhadelpi.com.br/health

# Login (troque email/senha)
curl -sS -X POST https://controle-mp.minhadelpi.com.br/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.com","password":"SUA_SENHA"}'
```

Se o login retorna `access_token`, a API e o proxy `/api` estão corretos; o problema é só sessão antiga no browser.

---

## Variáveis críticas em `.env.production`

| Variável | Observação |
|----------|------------|
| `JWT_SECRET` | **Não alterar** sem planejar logout geral |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Devem ser `cadastro-mp-api` e `cadastro-mp-front` |
| `VITE_PROD_API_BASE_URL` | Vazio = API relativa em `/api` (correto com nginx do front) |
| `CORS_ORIGINS` | Incluir `https://controle-mp.minhadelpi.com.br` |
| `CENTRAL_JWKS_URL` | No srv-api: preferir `host.docker.internal` (ver causa 3) |

---

## Rebuild após correção

```bash
cd ~/projetos/controle_mp
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build controle-mp-front controle-mp-api
```

Depois: abra o site em aba anônima e teste o login.
