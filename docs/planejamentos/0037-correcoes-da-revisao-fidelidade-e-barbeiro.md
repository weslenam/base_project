# Planejamento 0037: Correções da revisão (fidelidade e Barbeiro)

- **Status:** Concluído
- **Data:** 2026-11-09
- **Solicitado por:** Weslen
- **Relacionado:** planejamentos 0034, 0035 e 0036; ADRs 0010 e 0011
- **Commits:** `7126867` (PR #3, merge `29666ed`)
- **Issues:** #4 a #13 (registradas depois pelo planejamento 0038)

## Solicitação de origem

> pode fazer a code-review

> Item 4: "Atendido" pela Agenda deve seguir a regra do Balcão (só os atendimentos dele)? Recomendo que sim. "Faltou" continuaria valendo também para os que ele marcou.
> resposta: vamos com a sua remendação
>
> Item 5: o Barbeiro pode puxar para si um cliente agendado com outro barbeiro? Recomendo que não, exceto cliente avulso sem barbeiro definido ("Primeiro livre").
> resposta: sua recomendacao esta correta, não
>
> para o cashback temos que tratar como algo tipo conta bancaria pago com cashback clietne A e aparecer nos dois lados, ou seja para o cliente e para a barbearia

- **Quando:** 2026-11-09 · **Origem:** Conversa com o assistente (`/code-review` nível alto sobre `origin/feat/backend-acl-modulos..HEAD`)
- **Esclarecimentos:**
  - Faturamento numa comanda de R$50 com R$10 de cashback → **R$40, cashback como desconto.**
  - Cashback no fechamento → **linha "Cashback" entre as formas** (fora da conferência da gaveta).

## Objetivo

Corrigir os achados da revisão: resgate perdido na comanda, cashback no caixa e no painel, comanda travada com o módulo desligado, regras do Barbeiro (atendido pela Agenda, iniciar no Balcão, abrir comanda) e defeitos menores da fidelidade.

## Decisões

- **Atendido (Agenda):** com `agenda.ajudar`, só na própria coluna. Faltou segue "coluna dele ou o que marcou".
- **Iniciar (Balcão):** sem `agenda.gerenciar`, só o atendimento já dele ou avulso sem barbeiro ("Primeiro livre"), e sempre consigo.
- **Cashback:** abate como desconto (faturamento = o que entrou). Cliente: saída no extrato (já existe). Barbearia: linha "Cashback" no resumo e no fechamento do caixa, sem entrar na gaveta; painel do Business Center desconta o cashback do faturamento e do dinheiro esperado.

## Etapas

- [x] 1. Domínio: `podeAgirNaAgenda` (atendido só na própria coluna) e `podeAgirNoBalcao` (iniciar só o próprio ou avulso livre); resumo do caixa com a linha de cashback; testes.
- [x] 2. API: iniciar confere o barbeiro atual; Business Center e `resumo_barbearias()` descontam o cashback (migração); config da fidelidade valida inteiro e percentual mínimo (400); módulo desligado não trava comanda com resgate; extrato lido uma vez; prêmio de serviço excluído volta vazio. Testes de integração.
- [x] 3. Front: comanda não perde o resgate ao reabrir, ignora resposta antiga do saldo; "Abrir comanda" do Barbeiro abre a comanda na própria tela; linha de cashback no fechamento.
- [x] 4. Verificar: `pnpm verificar`, `api:integracao`, `verificar:layout`.

## Critérios de pronto

- Reabrir comanda com prêmio/cashback mantém o resgate; receber cobra o valor certo.
- Caixa e painel: R$50 com R$10 de cashback → faturamento R$40, gaveta R$40, linha Cashback R$10.
- Barbeiro não marca atendido de colega pela Agenda nem puxa cliente de colega no Balcão (403).
- Testes cobrindo cada item.

## Registro de mudanças

- 2026-11-09 — Plano criado a partir da revisão; decisões do Weslen registradas.
- 2026-11-09 — Implementado. Módulo desligado: o resgate pedido cai ao salvar (a comanda não trava). Migração `20261109120000_cashback_no_resumo.sql` recria `resumo_barbearias()` com o abatimento. Linha "Cashback usado" no resumo do caixa e no fechamento. No front, a chamada dupla de `saldo`/`extrato` do apiHttp ficou como está (o servidor agora lê o extrato uma vez). Verificado: `pnpm verificar`, `api:integracao` (120) e `verificar:layout` (81).
