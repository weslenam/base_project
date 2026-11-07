# BarberTime

Monorepo Nx com o app web (Vue 3), a API (Fastify) e as libs do design system. Tudo em **JavaScript puro**, sem TypeScript.

## Requisitos

- Node 22 (`nvm use`, lê o `.nvmrc`)
- pnpm via corepack (`corepack enable`)

## Primeiros passos

```bash
nvm use
corepack enable
pnpm install
pnpm dev          # sobe web (http://localhost:4200) e api (http://localhost:3333)
```

O Vite repassa `/api/*` para a API, então o front chama `fetch('/api/...')` sem se preocupar com CORS.

## Comandos

| Comando                                  | O que faz                                    |
| ---------------------------------------- | -------------------------------------------- |
| `pnpm dev`                               | `nx serve` do `barbertime` e da `api` juntos |
| `pnpm verificar`                         | lint + testes + build de todos os projetos   |
| `pnpm test` / `pnpm lint` / `pnpm build` | cada etapa isolada                           |
| `pnpm format`                            | Prettier no workspace                        |
| `pnpm nx serve barbertime`               | só o front                                   |
| `pnpm nx serve api`                      | só a API (`node --watch`)                    |
| `pnpm nx graph`                          | grafo de dependências                        |

## Estrutura

```
apps/
  barbertime/   → app Vue 3 + Vite + Vue Router (porta 4200)
  api/          → Fastify, rotas sob /api (porta 3333), roda direto no Node
libs/
  ui-tokens/    → variáveis CSS do design system
  ui-utils/     → formatarData, formatarMoeda... (sem framework)
  ui-vuetify/   → implementação ativa dos Ds* e de instalarUi (alias @barbertime/ui)
  ui-contrato/  → testes de contrato que toda implementação de UI precisa passar
docs/
  planejamentos/ → planos de trabalho com a solicitação de origem
```

## Regras do workspace

- **UI:** telas importam só de `@barbertime/ui` e `@barbertime/ui-utils` (skill `design-system`). O ESLint bloqueia `vuetify` e `@barbertime/ui-vuetify` no app. Para testar outra implementação: `UI_IMPL=quasar pnpm nx serve barbertime`.
- **Fronteiras:** `scope:front` e `scope:back` não se importam; código comum vai para uma lib `scope:shared`. Libs `type:ui` só dependem de outras `type:ui`.
- **Preferências:** seguem `.claude/rules/central-de-preferencias.md`.
- **Planejamento:** todo plano vira documento em `docs/planejamentos/` (skill `planejamento-documentado`).
- **Geradores Nx:** sempre com `--js` (e `--bundler=none` para libs), para não reintroduzir TypeScript.

## Configuração dos agentes de IA

`.claude/`, `.agents/`, `.cursor/`, `.github/`, `.opencode/`, `.codex/` e `.gemini/` trazem skills e instruções (Nx, design system, planejamento) para os assistentes de código.
