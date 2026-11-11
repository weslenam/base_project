# ADRs (Architecture Decision Records)

Decisões arquiteturais duradouras. O trabalho do dia a dia fica em `docs/planejamentos/`.

| Nº                                                               | Decisão                                                                 | Status                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| [0001](0001-saas-multi-tenant.md)                                | SaaS multi-tenant com banco compartilhado e isolamento por barbearia    | Aceito                |
| [0002](0002-docker-no-desenvolvimento.md)                        | Ambiente de desenvolvimento com WSL 2 e Docker                          | Aceito                |
| [0003](0003-identidade-visual-e-tokens.md)                       | Identidade visual industrial-urbana e tokens como fonte única           | Aceito                |
| [0006](0006-preferencias-na-sessao-sincronizadas-com-banco.md)   | Preferências na sessão, sincronizadas com o banco                       | Aceito (reconstruído) |
| [0007](0007-vuetify-substitui-quasar.md)                         | Vuetify substitui o Quasar                                              | Aceito (reconstruído) |
| [0008](0008-workspace-javascript-com-fastify.md)                 | Workspace em JavaScript puro com API Fastify                            | Substituído (0022)    |
| [0009](0009-stack-do-backend.md)                                 | Stack do backend: PostgreSQL, migrações, sessão e contexto da barbearia | Aceito (ORM: 0022)    |
| [0010](0010-acl-por-papeis-dentro-da-barbearia.md)               | Controle de acesso por papéis dentro da barbearia                       | Aceito                |
| [0011](0011-modulos-e-servicos-adicionais.md)                    | Módulos por barbearia e serviços adicionais (ex.: gateway de pagamento) | Aceito                |
| [0012](0012-configuracoes-da-barbearia.md)                       | Configurações da barbearia como dados do negócio (JSONB)                | Aceito                |
| [0013](0013-pagina-publica-e-modos-de-acesso.md)                 | Página pública de agendamento com modo de acesso escolhido pelo Dono    | Aceito                |
| [0014](0014-protecao-da-api-contra-abuso-e-entrada-maliciosa.md) | Proteção da API contra abuso e entrada maliciosa                        | Aceito                |
| [0015](0015-supabase-local-como-plataforma-de-banco.md)          | Supabase local como plataforma de banco, migrações e e-mail             | Aceito                |
| [0016](0016-identidade-atras-de-adaptador.md)                    | Identidade atrás de um adaptador, com Supabase Auth e BFF na API        | Aceito                |
| [0017](0017-schema-app-e-postgrest-fechado.md)                   | Schema `app` não exposto e PostgREST fechado ao front                   | Aceito                |
| [0018](0018-business-center-e-operadores-da-plataforma.md)       | Business Center e operadores da plataforma (2FA, RLS, auditoria)        | Aceito                |
| [0019](0019-recorrencias-e-previsao-de-fluxo.md)                 | Recorrências financeiras e previsão de fluxo de caixa                   | Aceito                |
| [0020](0020-testes-de-layout-com-playwright.md)                  | Testes de layout com Playwright (Chromium)                              | Aceito                |
| [0021](0021-estoque-por-movimentos-com-saldo-materializado.md)   | Estoque por movimentos com saldo materializado                          | Aceito                |
| [0022](0022-typescript-strict-e-kysely.md)                       | TypeScript strict e Kysely no acesso ao banco                           | Aceito                |

**Números 0004 e 0005:** livres. Os ADRs 0006 e 0007 mantêm os números do protótipo Agenda porque as regras e skills do repositório os citam assim. Eles foram **reconstruídos** a partir dessas regras, já que o texto original não veio junto. O próximo ADR novo é o 0023.

## Modelo

```markdown
# ADR NNNN: <título>

- **Status:** Proposto | Aceito | Substituído pelo NNNN
- **Data:** AAAA-MM-DD
- **Relacionado:** ...

## Contexto

## Decisão

## Consequências
```
