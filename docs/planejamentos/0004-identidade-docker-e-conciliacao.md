# Planejamento 0004: Identidade visual no código, ambiente Docker e conciliação da documentação

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0001 (fase 0) e 0003, ADRs 0001, 0002, 0003 e 0008
- **Commits:** ainda não commitado (branch `feat/kit-base-ds`)

## Solicitação de origem

> sim pode iniciar as fases de implementacao

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Contexto:** durante o planejamento 0003, chegaram da outra sessão `docs/definicao-e-escopo.md`, `docs/identidade-visual/`, os ADRs 0001–0003 e o planejamento 0001. Houve colisão de números e de decisões. O assistente fez três perguntas:
- **Esclarecimentos:**
  - A API fica com Fastify (ADR 0008) ou NestJS (ADR 0001 e definição)? → **Fastify.**
  - Onde estão o README de produto, o `docker-compose.yml`, o `docker/postgres/init.sql` e o `.env.example` citados pela outra sessão? → **Recrie a partir dos ADRs.**
  - Adaptar o kit à identidade do ADR 0003 agora? → **Adaptar agora.**

## Objetivo

1. Fazer o código consumir a identidade visual como manda o ADR 0003: tokens gerados do `tokens.json`, fontes servidas pelo próprio app, logos e tema do Vuetify.
2. Criar o ambiente Docker do ADR 0002.
3. Conciliar a documentação das duas sessões: numeração, índices, Fastify e README de produto.

**Fora do escopo:** telas de negócio do MVP, ORM e migrações, autenticação e o restante da fase 0 (onboarding, página pública, super admin).

## Decisões e restrições

- **Numeração:** valem os ADRs 0001–0003 e o planejamento 0001 da outra sessão. Os planejamentos desta sessão passaram a 0002 e 0003. O ADR reconstruído do Quasar foi descartado; o ADR 0007 cita o Quasar como herança do protótipo.
- **Tokens:** `libs/ui-tokens/scripts/gerar-tokens.mjs` gera `tokens.css` e `tokens.js` a partir de `docs/identidade-visual/tokens.json`. As variáveis têm o nome do token (`--cobre`, `--esp-4`, `--raio-sm`), o tema escuro fica em `[data-theme='dark']`, e a tipografia em `--tipo-<estilo>`. Um teste falha se os arquivos gerados estiverem desatualizados.
- **API pública da UI sem mudança:** `useTema` continua com `claro` e `escuro`, e grava `data-theme` com o id do tema (`light`/`dark`). O `DsBotao` ganhou a variante `fantasma` (referência `.bt-botao--fantasma`) e o `DsLayout` ganhou o slot `marca`.
- **Fontes:** Fontsource (Big Shoulders 700/800, Barlow 400–700, IBM Plex Mono 500), só o subconjunto latin, importadas por `@barbertime/ui-tokens`.
- **Docker:** a infraestrutura (Postgres 17, Redis 7, Mailpit) sobe por padrão. A `api` e a `web` ficam no perfil `apps`: no WSL 2, rodar `pnpm dev` direto é mais rápido. O papel `barbertime_app` é criado sem superusuário e sem BYPASSRLS.

## Etapas

- [x] 1. Gerador de tokens, target `nx run ui-tokens:gerar`, `base.css` com classes `ds-*` de tipografia e teste de sincronia.
- [x] 2. Tema do Vuetify com as cores da marca (cobre, aço, concreto, placa, grafite) e `data-theme`.
- [x] 3. Estilos dos `Ds*` conforme `referencia-componentes.css` (botões de 44px em maiúsculas, campos e tabela com `linha`/`placa`, títulos em Big Shoulders).
- [x] 4. App: favicon e ícone, marca no cabeçalho (negativo no tema escuro), telas com as classes `ds-*`.
- [x] 5. `docker-compose.yml`, `docker/postgres/init.sql`, `.env.example`, `.gitattributes` (LF) e Vite configurável por `VITE_HOST`/`API_URL`.
- [x] 6. Documentação: ADRs 0001, 0007 e 0008, definição (Fastify), índices e README com produto, conceitos do domínio e preparo do WSL 2.
- [x] 7. Verificação: `pnpm verificar`, `docker compose config` e Postgres no ar com o papel `barbertime_app` conferido.

## Critérios de pronto

- `pnpm verificar` passa e o teste de sincronia dos tokens está verde.
- `docker compose up -d` sobe a infraestrutura; `barbertime_app` faz login sem superusuário e sem BYPASSRLS.
- Nenhum documento cita NestJS como decisão vigente, nem arquivo ou ADR inexistente.

## Riscos e pendências

- **Conferência visual no navegador:** fica com o usuário; o ambiente não tem navegador.
- **Containers `api`/`web`:** o compose foi validado, mas o perfil `apps` não foi executado de ponta a ponta.
- **Design system publicado** (link no ADR 0003): mudar tokens exige atualizar a vitrine junto, e isso fica com quem alterar.
- **Ícones:** a identidade cita `@mdi/js` para ícones de interface. Ele entra junto com o primeiro `DsIcone`.

## Registro de mudanças

- 2026-11-07: Plano criado e concluído na mesma sessão, a partir das respostas acima.
