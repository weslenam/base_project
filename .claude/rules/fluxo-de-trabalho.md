# Fluxo de trabalho

Ordem obrigatória para todo pedido de código ou documentação neste repositório. Decidida no planejamento 0021; a etapa de segurança, no 0022.

Os hooks em `.claude/settings.json` (scripts em `.claude/hooks/`) **garantem** parte dela pelo harness, independentemente de memória:

- injetam este fluxo em todo pedido;
- lembram do grafo do graphify antes de buscas;
- **bloqueiam** edição de UI sem a skill `design-system`;
- **bloqueiam** `git commit` sem a revisão de segurança (`security-review`) sobre o que está em stage;
- **pedem confirmação** antes de git destrutivo ou push (`push`, `reset --hard`, `clean -f`, `branch -D`, `rebase`, `commit --amend`, `stash drop`, `rm -rf`), conforme a skill `git-guardrails`;
- atualizam o grafo ao fim de cada resposta.

## Ordem obrigatória

1. **Contexto pelo grafo.** Antes de qualquer Grep, Glob ou leitura de código, rode `graphify query "<pergunta>"` (ou `graphify explain`, `graphify path`, `graphify affected`). Abra arquivos só nas linhas que o grafo apontou. Sem `graphify` no PATH, use `~/.local/bin/graphify`.
2. **Entrevista.** Feature, tela, módulo novo, pedido vago ou mudança de arquitetura: carregue a skill `grill-me` e feche os requisitos com o Weslen antes de planejar. Correção pontual e clara dispensa.
3. **Planejamento.** Se o pedido exige planejar (feature, refatoração, migração, várias etapas), carregue a skill `planejamento-documentado` e escreva ou atualize o documento em `docs/planejamentos/` **antes** de codar, com a citação literal do pedido. O mini-spec do `grill-me` alimenta esse documento.
   - **Apresente o plano ao Weslen e espere a aprovação antes da etapa 4.** Escrever o documento não basta: mostre as decisões e as dúvidas em aberto e pare. Isso vale também para mudança pequena de regra ou permissão, e para pedidos que chegam no meio de outra tarefa. A exceção é a correção pontual e clara de bug, que segue a seção "Bugs e branches" (planejamento 0039).
4. **Skills por área, carregadas antes de editar:**
   - Qualquer alteração de código: skill `mudancas-cirurgicas` (mínimo necessário, sem refatorar fora do escopo).
   - UI Vue (`.vue`, `libs/ui-*`, tokens): skill `design-system`. **O hook nega a edição sem ela.**
   - Explorar a estrutura do workspace Nx: skill `nx-workspace`. Gerar projeto ou lib: skill `nx-generate`.
   - Configuração do Claude Code (hooks, permissões): skill `update-config`.
   - Git, apagar arquivos, branches ou histórico: skill `git-guardrails`.
5. **Implementar com testes.** Regras de negócio no `@barbertime/dominio`. API com RLS e permissões (ADRs 0009 a 0011). Teste novo para cada regra.
6. **Verificar.** `pnpm verificar` (lint, testes, build); com banco ou API envolvidos, `pnpm verificar:tudo`. Mudança de UI (`.vue`, `libs/ui-*`, tokens): também `pnpm verificar:layout` (Playwright, ADR 0020), com o `pnpm dev` no ar, e olhar as capturas de `apps/e2e-layout/capturas/`. Tela nova ganha spec de layout. Não declarar pronto com falha.
7. **Revisar.** Antes de abrir PR ou juntar na `main`, rode o plugin de revisão (`/code-review`) sobre o diff.
8. **Segurança (bloqueante).** Com tudo em stage (`git add`), carregue a skill `security-review` e revise o diff. Com achado aberto, corrija e revise de novo. Só sem achados, rode `.claude/hooks/registrar-security-review.sh`. **O hook nega `git commit`** sem a skill na sessão ou se o stage mudou depois do registro. Rota nova ou alterada segue o ADR 0014: parâmetros tipados, schema quando recebe corpo e limite próprio quando é pública ou trata credenciais.
9. **Fechar.**
   - Marque as etapas e o status no planejamento e atualize os índices (`docs/planejamentos/README.md`, ADRs).
   - Commit com a atribuição combinada.
   - O grafo é atualizado sozinho pelo hook `Stop`; após refatoração grande, rode `graphify update . --force`.

## Notas

- Plugins habilitados no projeto: `nx`, `frontend-design` (só inspiração; o design system prevalece), `superpowers` e `code-review`.
- Push, merge e PR são ações externas: sempre perguntar antes.
- Agentes do projeto (`.claude/agents/`), opcionais para delegar etapas: `planejador` (etapas 2 e 3, não escreve código), `implementador` (etapas 5 e 6, a partir de plano aprovado ou bug bem descrito) e `revisor` (complementa a etapa 7 antes do commit, não edita). Não substituem `/code-review` nem `security-review`.

## Bugs e branches (rastreabilidade)

Decidido no planejamento 0038. O objetivo é que, depois do merge e com a branch já apagada, ainda dê para saber **o que um bug afetou** e **de onde ele veio**.

1. **Todo bug vira issue no GitHub**, pelo modelo "Bug" (`.github/ISSUE_TEMPLATE/bug.yml`), com as etiquetas `bug`, `severidade:*` e `area:*`. A issue registra:
   - **o que foi afetado:** tela ou rota, papéis, módulos, e o código (cole a saída de `graphify affected "<símbolo>"`);
   - **onde foi introduzido:** commit, PR e planejamento (`git log -S` ou `git blame`).

   Bug achado em revisão ou em teste também vira issue, mesmo que seja corrigido na hora.

2. **A branch diz de onde vem:**
   - `feat/NNNN-slug`, `chore/NNNN-slug` e `docs/NNNN-slug`, onde NNNN é o planejamento;
   - `fix/<issue>-slug` para bug.
3. **A correção de bug leva:**
   - um **teste de regressão** que falha sem a correção, com `#<issue>` no nome;
   - `Fixes #<issue>` e `Introduzido em: <sha>` no commit ou no PR.
4. **Depois do merge**, que é feito com merge commit e não squash: apagar a branch, local e remota, e voltar para a `main` atualizada.
