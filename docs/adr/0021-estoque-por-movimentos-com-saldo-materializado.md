# ADR 0021: Estoque por movimentos com saldo materializado

- **Status:** Aceito
- **Data:** 2026-11-11
- **Relacionado:**
  - complementa ADR 0009 (RLS e multiempresa) e ADR 0022 (TypeScript/Kysely);
  - [planejamento 0027](../planejamentos/0027-estoque-compras-e-financeiro.md), fatia 1.

## Contexto

O módulo de estoque (fatia 1 do planejamento 0027) precisa rastrear entradas (compras, ajustes de inventário) e saídas (consumo em serviços, ajustes negativos) por produto, por barbearia. Há duas abordagens clássicas:

1. **Coluna `saldo`:** valor atual armazenado diretamente na linha do produto. Simples de ler, mas o histórico se perde.
2. **Tabela de movimentos:** cada entrada e saída é um registro. O saldo é calculado como `SUM(quantidade)`. Histórico completo, auditável.

A segunda abordagem é mais robusta para auditoria e rastreamento de consumo, mas exige que o `SUM` não seja recalculado a cada leitura.

## Decisão

- Cada alteração de estoque (entrada de compra, consumo, inventário) gera um **movimento** na tabela `app.movimentos_de_estoque` com `produto_id`, `quantidade` (positivo = entrada, negativo = saída) e referência de origem (`compra_id`, `comanda_id` ou `inventario`).
- O **saldo atual** é mantido em `app.saldo_de_estoque(barbearia_id, produto_id)` como coluna materializada: incrementada/decrementada por trigger após cada inserção em `movimentos_de_estoque`.
- Leituras de saldo usam a coluna materializada — `O(1)` em vez de `SUM`.
- O inventário (`POST /api/estoque/inventario`) calcula a diferença entre o contado e o saldo atual e insere um movimento de ajuste, mantendo o histórico rastreável.
- RLS em ambas as tabelas usa `app.barbearia_atual()`.

## Consequências

- Histórico completo de movimentação por produto: quem consumiu, quando e em qual comanda.
- Saldo sempre consistente: o trigger garante que a coluna não diverge dos movimentos.
- Inventários geram movimentos de ajuste, não sobrescrevem o saldo — o antes e o depois ficam registrados.
- A exclusão de movimentos é bloqueada (sem `DELETE`); cancelamentos geram movimento inverso.
