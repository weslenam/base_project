<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## UI e Design System

- Toda UI Vue deste workspace segue a skill `design-system`: componentes `Ds*` e composables sobre o framework de UI ativo (Vuetify, ADR 0007), sem usar a biblioteca de UI diretamente nas telas.
- Skills e plugins de design (`frontend-design`, `ui-ux-pro-max`, `taste`, `impeccable` etc.) servem apenas como **inspiração** (estética, layout, hierarquia visual, UX).
- Em caso de conflito, o design system **sempre prevalece**. Ideias vindas dessas skills entram via tokens de tema ou novos componentes `Ds*`, nunca burlando o contrato.

## Planejamento e documentação

- Todo planejamento vira documento em `docs/planejamentos/`, com a citação literal da solicitação que o originou. Siga a skill `planejamento-documentado` **antes** de implementar e mantenha o documento atualizado até concluir.

## Fluxo de trabalho (obrigatório)

- Siga a ordem de `.claude/rules/fluxo-de-trabalho.md`: grafo → planejamento → skills da área → implementar com testes → verificar → revisar → **segurança** → fechar. Hooks em `.claude/hooks/` garantem parte dela (injetam o fluxo, lembram do grafo, **bloqueiam UI sem a skill `design-system`**, **bloqueiam commit sem a skill `security-review`**, atualizam o grafo).

## graphify

O projeto tem um grafo de conhecimento do código em `graphify-out/` (gerado localmente, fora do git). Planejamento 0021.

- Com `graphify-out/graph.json` presente, rode `graphify query "<pergunta>"` antes do primeiro grep, busca ou leitura de código, e repita esta regra em todo prompt de subagente que explore código. Leia arquivos só nas linhas que o grafo ou uma leitura anterior apontaram. Use `graphify path "<A>" "<B>"` para relações, `graphify explain "<conceito>"` para conceitos e `graphify affected "<símbolo>"` para impacto de mudança.
- Leia `graphify-out/GRAPH_REPORT.md` só para revisão ampla de arquitetura.
- Sem `graphify` no PATH, use `~/.local/bin/graphify`. Sem o grafo (clone novo): `graphify extract . --code-only` (local, sem LLM).
- O hook `Stop` roda `graphify update .` quando há mudança de código; depois de refatoração que apaga código, `graphify update . --force`.
