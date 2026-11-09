# Planejamento 0038: Rastreabilidade de bugs e branches

- **Status:** Concluído
- **Data:** 2026-11-09
- **Solicitado por:** Weslen
- **Relacionado:** planejamentos 0021 (fluxo de trabalho), 0022 (gate de segurança), 0037 (correções da revisão)
- **Commits:** ainda não commitado

## Solicitação de origem

> pode apagar sim, como padrão apagar a branch nao utlizada apos merge

> mas temos que nos preocupar com bugs apra controlar a rastreabilidade

> temos que controlar as branch contextualizando-as e manter a rastreabilidade de affetada quando bug

- **Quando:** 2026-11-09 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Como registrar os bugs? → **Issues no GitHub.**
  - O que entra junto? → **Teste de regressão obrigatório; abrir issues dos bugs de hoje; regra no fluxo e na skill.**

## Objetivo

Todo bug vira uma issue que diz **o que afetou** (onde aparece, quem é atingido, o que no código, e qual commit e PR o introduziram). Toda branch diz **de onde vem** (planejamento ou issue). Com isso, apagar a branch depois do merge não perde nada: a ligação fica na issue, no PR, no merge commit e no teste de regressão.

**Fora do escopo:** CI e proteção da `main` (planejamento 0024, A1 a A3) e tags de versão.

## Decisões

- **Nome da branch com contexto:**
  - `feat/NNNN-slug`, `chore/NNNN-slug` e `docs/NNNN-slug`, onde NNNN é o planejamento;
  - `fix/<issue>-slug` para bug, por exemplo `fix/12-tela-branca-ao-sair`.
- **Issue de bug** (modelo `.github/ISSUE_TEMPLATE/bug.yml`), com estes campos:
  - resumo, passos, esperado, obtido;
  - **afetado:** tela ou rota, papéis, módulos, e símbolos e arquivos (saída do `graphify affected`);
  - **introduzido em:** commit, PR e planejamento (via `git log -S` ou `git blame`);
  - severidade e evidência.
- **Etiquetas:** `bug`, `severidade:alta|media|baixa` e `area:<módulo>`. As áreas são agenda, balcao, caixa, fidelidade, pacotes, estoque, acesso, administracao, business-center, publico e ui.
- **Correção:**
  - branch `fix/<issue>-slug`;
  - commit e PR com `Fixes #N` e uma linha `Introduzido em: <sha>`;
  - **teste de regressão obrigatório**, que falha sem a correção, com `#N` no nome do teste.
- **Depois do merge:** apagar a branch, local e remota. Usar merge commit, para preservar o histórico.

## Etapas

- [x] 1. Modelo de issue de bug e etiquetas no GitHub.
- [x] 2. Regras: `fluxo-de-trabalho.md` (seção de bugs e branches) e skill `git-guardrails` (nomes de branch, `Fixes #N`, apagar após merge).
- [x] 3. Issues dos bugs de hoje: os 10 achados da revisão (fechadas, corrigidos em `7126867`) e a tela em branco ao sair (aberta).
- [x] 4. Fechar: índice e commit (PR a pedido).

## Critérios de pronto

- "New issue → Bug" no GitHub abre o modelo com os campos de afetado e de origem.
- O fluxo e a skill descrevem o padrão de branch, de commit e de teste de regressão.
- Os 11 bugs de hoje estão registrados, cada um com os campos de afetado e de origem preenchidos.

## Registro de mudanças

- 2026-11-09 — Plano criado a partir das respostas do Weslen.
- 2026-11-09 — Implementado. Modelo `bug.yml` e 14 etiquetas (`severidade:*` e `area:*`) criados no GitHub. Regras em `fluxo-de-trabalho.md` e na skill `git-guardrails`, que agora permite apagar sem nova confirmação a branch de um PR já mesclado. Issues #4 a #13 registradas e fechadas (bugs da revisão, corrigidos em `7126867`) e #14 aberta (tela em branco ao sair). A branch deste plano segue o padrão novo: `chore/0038-rastreabilidade-de-bugs`.
