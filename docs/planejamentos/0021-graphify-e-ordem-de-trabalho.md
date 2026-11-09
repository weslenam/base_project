# Planejamento 0021: Graphify e ordem de trabalho garantida por hooks

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** weslenam
- **Relacionado:** `.claude/rules/fluxo-de-trabalho.md`; skills `design-system` e `planejamento-documentado`
- **Commits:** ver git log ("chore: graphify e fluxo de trabalho com hooks")

## Solicitação de origem

> precisamos implementar o graphify para otimizar tokens

> do jeito q estamos trabalhando aqui os agentes e as skills do projeto estão sendo utilizadas?

> entao precisamos garantir que temos ordem na execução e garantia do uso dos plugins inclusive o graphiify

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Como instalar o Graphify (o Python do WSL não tem pip nem venv)? → **"uv no seu usuário"**: `uv` em `~/.local/bin` e `graphifyy==0.9.96` fixo (de 26/10, mais de duas semanas de publicado).

## Objetivo

- Reduzir os tokens gastos explorando o código, com um grafo de conhecimento (Graphify) consultado antes de grep e leituras.
- Garantir, pelo harness e não pela memória do assistente, uma ordem de trabalho e o uso das skills e dos plugins do projeto.

**Fora do escopo:**

- extração semântica dos `.md` (exige LLM e chave de API);
- criar agentes próprios do projeto (a oferecer depois).

## Decisões e restrições

- **Grafo só do código, local** (`graphify extract . --code-only`, tree-sitter): nada sai da máquina e não gasta tokens. Ficou com 1.635 nós e 3.512 ligações em 238 arquivos, `.vue` incluídos. O benchmark do próprio graphify indica cerca de 78x por pergunta contra ler o corpus inteiro, que é o pior caso; o ganho real é menor e deve ser medido com `/usage`.
- **`graphify-out/` fora do git**: é derivado e se regenera em segundos.
- **Hooks versionados e portáveis** em `.claude/hooks/`, chamados via `$CLAUDE_PROJECT_DIR`, sem caminho de máquina. O `graphify claude install` gravava `/home/weslen/.local/bin/graphify` no `settings.json` versionado; isso foi trocado por um script que acha o binário no PATH ou em `~/.local/bin` e, sem graphify, não faz nada.
- **O que é garantido e como:**
  - `UserPromptSubmit` → `fluxo.sh`: injeta a "Ordem obrigatória" de `.claude/rules/fluxo-de-trabalho.md` em todo pedido.
  - `PreToolUse` Bash|Grep e Read|Glob → `graphify-guard.sh`: o lembrete do graphify antes de buscas.
  - `PreToolUse` Edit|Write → `exigir-design-system.sh`: **nega** editar `.vue` ou `libs/ui-*` se a skill `design-system` não foi carregada na sessão (confere na transcrição). Provado: uma edição de teste em `BalcaoView.vue` foi bloqueada.
  - `Stop` → `atualizar-grafo.sh`: se há código alterado mais novo que o grafo, roda `graphify update .`.
- **O que continua dependendo de disciplina** (não há como verificar por hook sem travar trabalho legítimo): planejamento antes de codar, rodar `/code-review` antes de PR e `pnpm verificar`. Está na ordem injetada em todo pedido.
- **Hooks do git e PATH no `~/.bashrc`** foram barrados pelo controle de permissões, por serem persistência fora do projeto. Isso não é necessário, porque o hook `Stop` atualiza o grafo e os scripts acham o binário sozinhos.

## Etapas

- [x] 1. Instalar `uv` e `graphifyy==0.9.96`; gerar o grafo e o relatório; benchmark.
- [x] 2. Skill `/graphify` em `~/.claude/skills` e seção no `CLAUDE.md`.
- [x] 3. Regra `.claude/rules/fluxo-de-trabalho.md` e hooks em `.claude/hooks/`, com teste de cada script e prova do bloqueio de UI.
- [x] 4. `.gitignore`, README e este documento.

## Riscos e pendências

- O guarda de UI confere a transcrição: depois de `/clear` a skill precisa ser carregada de novo (é o comportamento desejado).
- Atualizar o graphify: `~/.local/bin/uv tool install graphifyy==<versão> --force`, escolhendo versão com pelo menos duas semanas.
- Quem clonar o repositório precisa instalar o graphify (README). Sem ele os hooks não fazem nada, exceto o guarda de UI, que continua valendo.

## Registro de mudanças

- 2026-11-08: plano criado e concluído na mesma sessão.
