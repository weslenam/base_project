# Planejamento 0029: Correções da revisão do Business Center e do estoque

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** planejamentos 0027 (estoque) e 0028 (Business Center); ADR 0018; PR #3
- **Commits:** ainda não commitado

## Solicitação de origem

> os dsois

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Pergunta do assistente: "abrir o PR para a `main` (antes eu rodo o `/code-review` no diff) ou começar a S3 do planejamento 0025?" → "os dsois".
  - O PR #3 já estava aberto para a branch. O `/code-review` rodou nos 6 commits ainda não revisados (`9b241e7..HEAD`: estoque, S0 a S2, Business Center e semente). Este documento trata dos achados. A S3 segue no planejamento 0025.

## Objetivo

Corrigir os achados da revisão que se confirmaram, com teste para cada um, antes de seguir para a S3.

**Fora do escopo:**

- remover `apps/api/migracoes/` e o `node-pg-migrate`, que já é a S8 do planejamento 0025;
- otimizar a consulta extra de suspensão em `fastify.autenticado`;
- a diferença de arredondamento de `resumo_barbearias()` quando o desconto passa do subtotal, que exige uma migração (anotada em _Riscos_).

## Achados e decisão

| #   | Achado                                                                                              | Decisão                                                                            |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Business Center não voltava ao login com a sessão expirada (401 sem tratamento e operador em cache) | Corrigir: gancho `aoExpirarSessao` no `http.js`, registrado no `main.js`           |
| 2   | Agendamentos do mês incluíam o dia 1º do mês seguinte (`<=`)                                        | Corrigir: limite exclusivo (`<`)                                                   |
| 3   | Rotas novas de estoque sem `params` tipado                                                          | **Falso positivo:** o hook `onRoute` de `seguranca/entrada.js` já tipa todo `:id`  |
| 4   | POST e PUT de `/produtos` devolviam custo e saldo a quem não tem `estoque.ver`                      | Corrigir: mesma redação do GET (`semCusto`)                                        |
| 5   | Compra com data antiga sobrescrevia o último custo                                                  | Corrigir: recalcular pela compra válida mais recente, igual ao cancelamento        |
| 6   | Auditoria gravada fora da transação da ação                                                         | Corrigir: `auditar(c, …)` dentro da transação; reativar passa a usar `emTransacao` |
| 7   | Aberturas de painel (`ver_painel`) empurravam as ações para fora do histórico de 50 linhas          | Corrigir: continuam auditadas, mas o histórico do painel as ignora                 |
| 8   | Painel chamava `resumo_barbearias()`, que agrega a plataforma inteira                               | Corrigir: `max(caixas.data)` lido dentro da RLS da barbearia                       |
| 9   | Migrações JS e `node-pg-migrate` mortos                                                             | Adiado para a S8 do planejamento 0025                                              |
| 10  | Consulta extra de suspensão por requisição                                                          | Não corrigir agora (desempenho, sem erro)                                          |

## Etapas

- [x] 1. Correções 1, 2, 4, 5, 6, 7 e 8.
- [x] 2. Testes:
  - `http.spec.js` do Business Center (401 avisa, as outras recusas não);
  - painel: agendamento do dia 1º seguinte fora do mês e `ver_painel` auditado mas fora do histórico;
  - estoque: POST e PUT sem custo e compra antiga sem sobrescrever o custo.
- [x] 3. `pnpm verificar:tudo`, `security-review` e commit.

## Critérios de pronto

- Testes novos verdes e `pnpm verificar:tudo` verde.
- Revisão de segurança sem achados.

## Riscos e pendências

- `resumo_barbearias()` recalcula o total da comanda em SQL sem limitar a zero. Se um desconto passar do subtotal, o faturamento da lista difere do painel. A API valida o desconto; corrigir na próxima migração que tocar a função.

## Registro de mudanças

- 2026-11-08: criado a partir do `/code-review` de `9b241e7..HEAD`.
- 2026-11-08: concluído. `pnpm verificar:tudo` verde (integração: 98 testes; Business Center: 8).
