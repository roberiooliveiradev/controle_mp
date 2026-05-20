# Documentação — Controle MP

Índice central da documentação do monorepo. Comece pelo [README principal](../README.md).

## Documentação do monorepo

| Arquivo | Descrição |
|---------|-----------|
| [ARQUITETURA.md](ARQUITETURA.md) | Visão arquitetural, stack, integrações, fluxo de dados |
| [GUIA_DESENVOLVIMENTO.md](GUIA_DESENVOLVIMENTO.md) | Setup local, Docker, migrations, deploy, troubleshooting |
| [API_REFERENCE.md](API_REFERENCE.md) | Referência consolidada de endpoints REST |

## API (`api-cadastro-mp`)

| Arquivo | Descrição |
|---------|-----------|
| [../api-cadastro-mp/README.md](../api-cadastro-mp/README.md) | Visão geral, execução e estrutura da API |
| [estrutura_do_projeto_cadastro_mp.md](../api-cadastro-mp/docs/estrutura_do_projeto_cadastro_mp.md) | Clean Architecture — pastas e camadas |
| [tutorial_admin_local_e_migrations_controle_mp.md](../api-cadastro-mp/docs/tutorial_admin_local_e_migrations_controle_mp.md) | Admin local, migrations, deploy seguro |
| [documentacao_do_banco_de_dados_migrations_e_seeds.md](../api-cadastro-mp/docs/documentacao_do_banco_de_dados_migrations_e_seeds.md) | Schema, migrations SQL, seeds |
| [documentacao_modulo_de_usuarios_e_autenticacao.md](../api-cadastro-mp/docs/documentacao_modulo_de_usuarios_e_autenticacao.md) | JWT, refresh, SSO, logout |
| [documentacao_modulo_de_conversas.md](../api-cadastro-mp/docs/documentacao_modulo_de_conversas.md) | Conversas e participantes |
| [documentacao_rotas_de_conversations.md](../api-cadastro-mp/docs/documentacao_rotas_de_conversations.md) | Rotas HTTP de conversas |
| [documentacao_modulo_de_requests.md](../api-cadastro-mp/docs/documentacao_modulo_de_requests.md) | Solicitações, itens, campos, status |
| [documentacao_web_socket_realtime.md](../api-cadastro-mp/docs/documentacao_web_socket_realtime.md) | Socket.IO, eventos, salas |
| [GPT_Instructions.md](../api-cadastro-mp/GPT_Instructions.md) | Schema SQL de referência para ferramentas |

## Frontend (`front-cadastro-mp`)

| Arquivo | Descrição |
|---------|-----------|
| [../front-cadastro-mp/README.md](../front-cadastro-mp/README.md) | Rotas, scripts, integração com API |
| [documentacao_do_frontend_controle_mp.md](../front-cadastro-mp/docs/documentacao_do_frontend_controle_mp.md) | Detalhamento técnico do SPA |

## Ordem sugerida para novos desenvolvedores

1. [README principal](../README.md) — visão e quick start
2. [GUIA_DESENVOLVIMENTO.md](GUIA_DESENVOLVIMENTO.md) — subir o ambiente
3. [ARQUITETURA.md](ARQUITETURA.md) — entender camadas e integrações
4. [API_REFERENCE.md](API_REFERENCE.md) — contratos HTTP
5. Módulos em `api-cadastro-mp/docs/` conforme a feature trabalhada
6. [documentacao_do_frontend_controle_mp.md](../front-cadastro-mp/docs/documentacao_do_frontend_controle_mp.md) — UI e fluxos

## Atualização desta documentação

Última revisão consolidada: **maio/2026**. Ao alterar rotas, variáveis de ambiente ou fluxos de negócio, atualize:

- Este índice, se novos arquivos forem criados
- [API_REFERENCE.md](API_REFERENCE.md) para endpoints
- [ARQUITETURA.md](ARQUITETURA.md) para mudanças estruturais
- READMEs de `api-cadastro-mp` e `front-cadastro-mp`
