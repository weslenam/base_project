# ADR 0019: Recorrências e previsão de fluxo de caixa

- **Status:** Aceito
- **Data:** 2026-11-11
- **Relacionado:**
  - complementa ADR 0009 (RLS e multiempresa) e ADR 0022 (TypeScript/Kysely);
  - [planejamento 0027](../planejamentos/0027-estoque-compras-e-financeiro.md), fatia 2B.

## Contexto

Contas a pagar e a receber (fatia 2A) cobrem lançamentos avulsos. A maioria das despesas fixas de uma barbearia — aluguel, assinaturas, folha — é recorrente: mesmo valor, mesmo dia do mês, mês a mês. Sem modelar isso, o usuário precisa criar a mesma conta manualmente toda vez, com risco de esquecimento.

Além disso, a tela de contas não dá visibilidade do futuro: o saldo previsto para os próximos 30, 60 ou 90 dias exige que o sistema projetar as contas que ainda não existem.

## Decisão

### Recorrências

- Uma `recorrencia` armazena as propriedades fixas (tipo, descrição, categoria, valor, dia do mês, fornecedor opcional) sem gerar todas as contas de uma vez.
- Ao salvar ou listar recorrências, o serviço gera exatamente as **3 próximas contas em aberto** (da data atual em diante). A geração é idempotente: antes de inserir, verifica se já existe conta com o mesmo `(recorrencia_id, vencimento, situacao != 'cancelada')`.
- O campo `dia_do_mes` aceita apenas 1–28 para funcionar em todos os meses (fevereiro incluído).
- **Encerrar** seta `encerrada_em = hoje` na recorrência e cancela todas as contas futuras em aberto (`vencimento > hoje AND situacao = 'aberta'`). Encerrar novamente retorna 409.
- Contas geradas por recorrência são baixadas, estornadas e canceladas da mesma forma que contas avulsas.

### Previsão de fluxo

- O endpoint `GET /financeiro/previsao?dias=` (30, 60 ou 90) consulta contas com situação `aberta` ou `vencida` no período `[hoje, hoje + dias]`.
- A lógica de agrupamento por semana (`agruparPrevisaoPorSemana`) fica no domínio (`@barbertime/dominio`) — sem acesso ao banco.
- Vencidas (vencimento < hoje, ainda abertas) são separadas em `vencidaPagar` e `vencidaReceber`.
- Contas futuras são agrupadas por semana ISO (segunda como início), com `pagar`, `receber` e `saldo` por semana.
- A resposta inclui totais globais e breakdown por categoria.

### Segurança

- RLS na tabela `recorrencias` usa a mesma `app.barbearia_atual()` das demais tabelas do schema `app`.
- FK composta `(barbearia_id, recorrencia_id)` em `contas` → `recorrencias(barbearia_id, id)` impede que uma barbearia acesse recorrências de outra.
- `DELETE` não é concedido em `recorrencias`; use `encerrar`.

## Consequências

- Usuários não precisam criar manualmente contas mensais recorrentes.
- A tela de previsão exibe o saldo futuro agrupado por semana, com destaque para contas já vencidas.
- Ao encerrar uma recorrência, as contas futuras em aberto são canceladas automaticamente — sem necessidade de intervenção manual.
- Contas geradas automaticamente são indistinguíveis das avulsas para fins de baixa e estorno.
