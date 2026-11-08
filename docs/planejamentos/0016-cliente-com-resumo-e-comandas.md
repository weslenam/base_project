# Planejamento 0016: Cadastro do cliente com resumo e histórico de comandas

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0006 (clientes), 0008 (comandas), 0011 (sem rolagem) e 0015 (fidelidade e pacotes)
- **Commits:** ainda não commitado (branch `feat/backend-acl-modulos`)

## Solicitação de origem

> aqui podemos aumentar a tela para ver o historico das comandas podemos ver o valor deixar uma opção de mostrar as ultimas comandas com scroll tipo ver mais... mas onde esta escrito na tela o escritorio podemos deixar um resumo tipo historio em serviços ... produto ... ultimo serviço... mas temos que evitar scroll tudo na mesma tela

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente, com captura do diálogo "Editar cliente". Desenho à mão sobre a captura: um painel à direita do formulário, com duas abas no alto e a palavra "Histórico" riscada.
- **Interpretação:** "escritorio" = o título "Histórico" da tela. No lugar dele vai um resumo: total em serviços, total em produtos e último serviço.

## Objetivo

Diálogo do cliente maior, em duas colunas, sem rolagem da tela:

- **à esquerda**, o cadastro (nome, telefone, CPF, observações);
- **à direita**, um painel com abas:
  1. **Resumo:** total em serviços, total em produtos, total gasto, número de comandas, ticket médio, último serviço (com data e barbeiro), última visita e faltas. Com os módulos ativos, também selos, cashback e pacotes.
  2. **Comandas:** as mais recentes primeiro, com data, itens, valor e forma de pagamento. Mostra 5 por vez e tem **"Ver mais"**. A lista rola por dentro do painel, e o diálogo não rola.
  3. **Agendamentos:** o histórico que já existia.

**Fora do escopo:** editar comandas pelo cadastro do cliente (abrir a comanda continua sendo no caixa).

## Decisões

- **`resumoDeComandas`** na lib `dominio` (puro, em centavos): soma só as comandas **pagas**, e o desconto entra só no total gasto. Os totais por tipo são o valor bruto de serviços e de produtos; o item de pacote vendido conta em serviços, como no total da comanda.
- **API em memória:** `clientes.resumo(id)` e `clientes.comandas(id, { limite, deslocamento })`, que devolve `{ itens, total }` para o "Ver mais". A data da comanda vem do caixa em que ela foi lançada.
- **Dados de exemplo** ganham caixas e comandas de dias anteriores, coerentes com os atendimentos do histórico. O Rafael fica com mais de 5 comandas, para o "Ver mais" aparecer.
- Diálogo `xl` e `fechavel`. O painel tem altura máxima com rolagem interna só na lista de comandas, e as colunas empilham em telas estreitas.

## Etapas

- [x] 1. `resumoDeComandas` com testes.
- [x] 2. Dados e API: caixas e comandas antigas, `clientes.resumo` e `clientes.comandas`, com testes.
- [x] 3. `ClienteDialogo` em duas colunas, com as abas Resumo, Comandas ("Ver mais") e Agendamentos.
- [x] 4. Testes de tela e `pnpm verificar`.

## Critérios de pronto

- O resumo mostra os totais de serviços e de produtos, que batem com as comandas pagas.
- "Ver mais" traz as próximas 5 comandas, até acabar.
- Nenhuma rolagem do diálogo; só a lista de comandas rola, se passar da altura do painel.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. Testes: 2 de domínio, 2 de dados e 4 de tela (totais do resumo, "Ver mais" de 5 para 7 até sumir, aba de agendamentos, cliente novo sem painel). **Estimativa de altura** (1366×768, aba Resumo com fidelidade e pacotes): título 64 + abas 56 + números 120 + último serviço 40 + fidelidade e pacotes ~130 + rodapé 70 + margens 48 ≈ **530px**, contra cerca de 720px. Na aba Comandas, a lista rola por dentro a partir de 42% da altura da tela. A conferência visual fica com o usuário.
- 2026-11-07: Dois testes de tela que esperavam "Comanda #4" passaram a aceitar qualquer número, porque as comandas antigas de exemplo ocupam os números 4 a 10.
