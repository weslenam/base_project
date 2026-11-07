# Planejamento 0001: Esqueleto do workspace Nx

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** skill `design-system`, rule `central-de-preferencias`
- **Commits:** ainda não commitado

## Solicitação de origem

> teste este projeto e instale as dependencias

> consegue fazer as adaptações para a base estar apta a trabalharmos?

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Node v18.17.1 não atende o Nx atual; instalar Node 22 LTS pelo nvm? → Instalar Node 22 LTS.
  - Gerenciador de pacotes? → pnpm (via corepack).
  - Stack do backend? → Node + Fastify (JS).
  - Escopo inicial? → Só esqueleto (workspace, app e libs vazias configuradas, lint e testes rodando; sem componentes Ds\*).

## Objetivo

Transformar o repositório (hoje só skills e configs de agentes) num workspace Nx funcional, com o app Vue, o backend Fastify e as libs de UI previstas na skill `design-system`, todos com lint e testes passando.

**Fora do escopo:** componentes `Ds*`, composables de UI, tela `/preferencias`, catálogo e API de preferências, banco de dados, ADRs 0003/0006/0007 (citados pelas skills, mas vindos do protótipo Agenda).

## Decisões e restrições

- **Node 22 LTS + `.nvmrc`**: o Nx e o Vite atuais exigem Node 20 ou mais novo.
- **pnpm** via corepack, com `pnpm-workspace.yaml`.
- **JavaScript puro, sem TypeScript** (skill `design-system`). Os `tsconfig*.json` criados pelos geradores foram removidos (com eles, os targets `typecheck`). Fica só um `jsconfig.json` na raiz, para o editor resolver o alias `@barbertime/ui`.
- **Projetos:**
  - `apps/barbertime`: Vue 3 + Vite + Vitest.
  - `apps/api`: Fastify (JS, ESM), com rota de saúde `GET /api/saude`. Roda direto no Node (`node --watch src/main.js`), sem etapa de build: o executor do esbuild exige `tsconfig` e não há o que transpilar.
  - `libs/ui-tokens`, `libs/ui-utils`, `libs/ui-vuetify`, `libs/ui-contrato`: libs não buildáveis (o consumidor compila o código-fonte).
- **Alias `@barbertime/ui`** no Vite do app aponta para `libs/ui-${UI_IMPL}` (padrão `vuetify`).
- **Lint de fronteira**: o app não pode importar `vuetify` nem `@barbertime/ui-vuetify` diretamente (`no-restricted-imports`).
- Projetos criados com os geradores do Nx sempre que houver gerador adequado.
- **Fronteiras Nx** (`@nx/enforce-module-boundaries`): `scope:front` e `scope:back` não se importam; `type:ui` só depende de `type:ui`.
- **Proxy** do Vite: `/api` vai para `localhost:3333`.
- Versões fixas: Nx 24.0.1 (publicado há mais de duas semanas), pnpm 12.18.0, Node 22.23.4.

## Etapas

- [x] 1. Instalar o Node 22 pelo nvm, criar `.nvmrc` e ativar o pnpm via corepack.
- [x] 2. Criar `package.json`, `pnpm-workspace.yaml`, `nx.json` e `.gitignore`, e instalar o Nx e os plugins (`@nx/vue`, `@nx/vite`, `@nx/node`, `@nx/js`, `@nx/eslint`).
- [x] 3. Gerar `apps/barbertime` (Vue, JS) e ajustar o alias `@barbertime/ui` e o lint de fronteira.
- [x] 4. Gerar `apps/api` (Fastify, JS) com a rota de saúde e um teste.
- [x] 5. Gerar as libs `ui-tokens`, `ui-utils`, `ui-vuetify` e `ui-contrato`, com um `index.js` mínimo e um teste em cada uma.
- [x] 6. Ajustar o README com os comandos do dia a dia.
- [x] 7. Verificar com `pnpm nx run-many -t lint,test,build`.

## Critérios de pronto

- `pnpm install` roda limpo.
- `pnpm nx run-many -t lint,test,build` passa em todos os projetos.
- `pnpm nx serve barbertime` e `pnpm nx serve api` sobem sem erro.

## Riscos e pendências

- ADRs 0003, 0006 e 0007 são citados pelas skills, mas não existem neste repositório. Recriar ou ajustar as referências.
- Os geradores do Nx priorizam TypeScript. Ao gerar projetos novos, usar `--js` (e `--bundler=none` em libs) e remover os `tsconfig*.json` criados.
- O Nx avisa que a configuração dos agentes de IA está desatualizada (`nx configure-ai-agents`). Não rodado: reescreveria as skills versionadas em `.agents/`, `.cursor/` etc.
- `ui-tokens` tem só valores provisórios; a identidade visual ainda precisa ser definida.
- O Vuetify 4 entra como dependência só quando o kit `Ds*` for implementado.

## Registro de mudanças

- 2026-11-07: Plano criado a partir dos esclarecimentos acima.
- 2026-11-07: Os targets `typecheck` e o build da API com esbuild foram removidos durante a execução, por serem resquícios de TypeScript.
- 2026-11-07: Concluído. `pnpm verificar` passa nos 6 projetos; `pnpm dev` sobe web e API; `/api/saude` responde direto e pelo proxy; o lint bloqueia `vuetify` e `@barbertime/ui-vuetify` no app.
