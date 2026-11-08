# Fluxo de trabalho

Ordem obrigatória para todo pedido de código ou documentação neste repositório. Decidida no planejamento 0021; a etapa de segurança, no 0022.

Os hooks em `.claude/settings.json` (scripts em `.claude/hooks/`) **garantem** parte dela pelo harness, independentemente de memória:

- injetam este fluxo em todo pedido;
- lembram do grafo do graphify antes de buscas;
- **bloqueiam** edição de UI sem a skill `design-system`;
- **bloqueiam** `git commit` sem a revisão de segurança (`security-review`) sobre o que está em stage;
- atualizam o grafo ao fim de cada resposta.

## Ordem obrigatória

1. **Contexto pelo grafo.** Antes de qualquer Grep, Glob ou leitura de código, rode `graphify query "<pergunta>"` (ou `graphify explain`, `graphify path`, `graphify affected`). Abra arquivos só nas linhas que o grafo apontou. Sem `graphify` no PATH, use `~/.local/bin/graphify`.
2. **Planejamento.** Se o pedido exige planejar (feature, refatoração, migração, várias etapas), carregue a skill `planejamento-documentado` e escreva ou atualize o documento em `docs/planejamentos/` **antes** de codar, com a citação literal do pedido.
3. **Skills por área, carregadas antes de editar:**
   - UI Vue (`.vue`, `libs/ui-*`, tokens): skill `design-system`. **O hook nega a edição sem ela.**
   - Explorar a estrutura do workspace Nx: skill `nx-workspace`. Gerar projeto ou lib: skill `nx-generate`.
   - Configuração do Claude Code (hooks, permissões): skill `update-config`.
4. **Implementar com testes.** Regras de negócio no `@barbertime/dominio`. API com RLS e permissões (ADRs 0009 a 0011). Teste novo para cada regra.
5. **Verificar.** `pnpm verificar` (lint, testes, build); com banco ou API envolvidos, `pnpm verificar:tudo`. Não declarar pronto com falha.
6. **Revisar.** Antes de abrir PR ou juntar na `main`, rode o plugin de revisão (`/code-review`) sobre o diff.
7. **Segurança (bloqueante).** Com tudo em stage (`git add`), carregue a skill `security-review` e revise o diff. Com achado aberto, corrija e revise de novo. Só sem achados, rode `.claude/hooks/registrar-security-review.sh`. **O hook nega `git commit`** sem a skill na sessão ou se o stage mudou depois do registro. Rota nova ou alterada segue o ADR 0014: parâmetros tipados, schema quando recebe corpo e limite próprio quando é pública ou trata credenciais.
8. **Fechar.**
   - Marque as etapas e o status no planejamento e atualize os índices (`docs/planejamentos/README.md`, ADRs).
   - Commit com a atribuição combinada.
   - O grafo é atualizado sozinho pelo hook `Stop`; após refatoração grande, rode `graphify update . --force`.

## Notas

- Plugins habilitados no projeto: `nx`, `frontend-design` (só inspiração; o design system prevalece), `superpowers` e `code-review`.
- Push, merge e PR são ações externas: sempre perguntar antes.
