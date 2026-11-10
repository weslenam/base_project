# ADR 0008: Workspace em JavaScript puro com API Fastify

- **Status:** Substituído pelo [ADR 0022](0022-typescript-strict-e-kysely.md) (2026-11-09): o workspace passa a TypeScript strict; o Fastify continua
- **Data:** 2026-11-07
- **Relacionado:** [planejamento 0002](../planejamentos/0002-esqueleto-do-workspace.md)

## Contexto

A skill `design-system` define Vue 3 em JavaScript, sem TypeScript. O esqueleto do workspace precisava de uma API e de convenções que não reintroduzissem TypeScript pelos geradores do Nx.

## Decisão

- **Monorepo Nx com pnpm e Node 22.** Libs não buildáveis: o consumidor compila o código-fonte.
- **JavaScript puro em todo o workspace.** Sem `tsconfig` nem targets de `typecheck`; um `jsconfig.json` na raiz serve só ao editor.
- **API em Fastify, ESM.** Roda direto no Node, sem etapa de build, com rotas sob `/api`.
- **Fronteiras por tags:** `scope:front`, `scope:back`, `scope:shared` e `type:ui`, verificadas pelo `@nx/enforce-module-boundaries`.

## Alternativa descartada

NestJS, citado na primeira versão da definição do produto. Ele é pensado para TypeScript, e em JavaScript puro exigiria Babel para os decorators. Decisão do usuário em 2026-11-07: Fastify.

## Consequências

- Geradores do Nx sempre com `--js` (e `--bundler=none` em libs), e os `tsconfig` gerados são removidos.
- Sem checagem de tipos: testes e lint carregam essa responsabilidade.
- Código compartilhado entre front e back vai para uma lib `scope:shared`.
- Multi-tenant (ADR 0001): um hook de requisição do Fastify resolve o tenant (token ou slug) e o define na sessão do banco antes de cada consulta.
