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

### Causa 3: SSO / JWKS incorreto

No Docker de produção, **não use** `host.docker.internal` se o Keycloak não estiver acessível por esse host. Prefira URL pública:

```env
CENTRAL_JWKS_URL=https://minhadelpi.com.br/auth/realms/delpi/protocol/openid-connect/certs
```

Login direto em `https://controle-mp.minhadelpi.com.br/login` (email/senha local) não depende do JWKS.

---

## Notificações não aparecem no sino da Minha DELPI

1. Confirme na API: `DELPI_NOTIFICATIONS_ENABLED=true` e `CORE_API_INTEGRATIONS_SERVICE_TOKEN` igual ao `infra/.env` do delpi-central.
2. O e-mail do usuário no Controle MP deve ser **o mesmo** do cadastro na Minha DELPI (Keycloak).
3. Após deploy da correção de destinatários, **admin/analista** passam a receber alerta de mensagens mesmo sem ter aberto a conversa antes.
4. Veja logs: `docker logs <container-api> 2>&1 | grep DELPI`
5. `DELPI_PORTAL_CONTROLE_MP_ROUTE` deve ser o `basePath` real do app (ex. `/controle_mp`, não `/apps/controle-mp` se o portal usar outro path).

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
| `CENTRAL_JWKS_URL` | URL pública do Keycloak em produção |

---

## Rebuild após correção

```bash
cd ~/projetos/controle_mp
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build controle-mp-front controle-mp-api
```

Depois: abra o site em aba anônima e teste o login.
