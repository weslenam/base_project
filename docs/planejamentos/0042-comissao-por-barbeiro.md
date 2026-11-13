# Planejamento 0042: Comissão por barbeiro

- **Status:** Aprovado
- **Data:** 2026-11-12
- **Solicitado por:** weslenam
- **Relacionado:** planejamento 0001 (item 6 do MVP), planejamento 0027 (financeiro)
- **Commits:** ainda não commitado

## Solicitação de origem

> quanto tempo precisa para implementar a comissao?

> salve este planejamento faremos ele daqui a pouco

- **Quando:** 2026-11-12 · **Origem:** Conversa com o assistente

### Solicitações relacionadas

> a comissão precisa ser totalmente rastreavel (2026-11-12)

> as comissões devem ser uma ativação modular, se ativado, o sistema passa a gerir apos a ativação e isso resolve o problema do hoje, amanha ou depois, porque pode acontecer de não ser necessario o calculo de comissão (2026-11-12)

## Objetivo

Implementar o controle de comissão por barbeiro (item 6 do MVP do planejamento 0001): calcular, visualizar e fechar comissões a partir das comandas pagas, usando a taxa percentual já cadastrada no barbeiro.

**Módulo:** `comissoes` já existe no catálogo (`libs/dominio/src/modulos.ts`, tipo `incluso`). Quando `ativo`, o pagamento de comanda gera a linha de comissão. Quando `inativo`, não gera nada — sem retroativo.

**Fora do escopo:** taxa por serviço individualmente (a taxa é a do barbeiro, única); relatórios de faturamento gerais (planejamento futuro).

## Decisões e restrições

| Decisão | Motivo |
|---|---|
| Taxa fixa por barbeiro (já existe `barbeiros.comissao`) | Campo já cadastrado na tela Equipe; evita migração em `Servicos` |
| Base de cálculo: valor líquido da comanda (após desconto) | Decisão do usuário: comissão sobre o que o cliente realmente pagou |
| Cashback usado (`comandas.cashbackUsado`) também reduz a base | Cashback é desconto na prática; tratado igual ao desconto |
| Rastreabilidade total: cada linha de comissão aponta para a comanda de origem | Decisão do usuário: "a comissão precisa ser totalmente rastreável" |
| A linha de comissão guarda: `comandaId`, `barbeiroId`, `barbeariaId`, `baseCalculo`, `taxa`, `valor`, `dataComanda`, `observacao` | Permite auditar de onde veio qualquer centavo; `observacao` é opcional e livre |
| Ativação via módulo `comissoes` (já no catálogo, tipo `incluso`) | Decisão do usuário: modular — começa a gerir só após ativação; barbearias que não usam não são afetadas |
| Sem retroativo: só comandas pagas com o módulo ativo geram linha de comissão | Consequência da ativação modular; corte limpo, sem backfill |
| Fechamento de período: registrar data, valor total e quem fechou | Rastreabilidade e histórico |

## Modelo de dados

```
comissoes
  id              serial PK
  barbeariaId     FK barbeiros(id)
  barbeiroId      FK barbeiros(id)
  comandaId       FK comandas(id)   ← rastreabilidade: origem exata
  dataComanda     date              ← denormalizado para filtro rápido por período
  baseCalculo     numeric(12,2)     ← valor líquido da comanda (após desconto e cashback)
  taxa            numeric(5,2)      ← % no momento do cálculo (snapshot, não referência viva)
  valor           numeric(12,2)     ← baseCalculo × taxa / 100 (arredondado)
  observacao      text | null       ← livre; ex.: "Semana do Pai – campanha especial"
  fechamentoId    FK comissoesFechamentos(id) | null

comissoesFechamentos
  id              serial PK
  barbeariaId     FK
  barbeiroId      FK
  de              date
  ate             date
  total           numeric(12,2)
  fechadoPor      FK usuarios(id)
  fechadoEm       timestamptz
```

## Etapas

- [x] 1. Decisão de base de cálculo: valor líquido (após desconto + cashback) — 2026-11-12
- [ ] 2. Migração: tabelas `comissoes` e `comissoesFechamentos`
- [ ] 3. Domínio: `calcularComissao({ valorTotal, desconto, cashbackUsado, taxa })` + testes unitários
- [ ] 4. API — service: gerar linha de comissão ao pagar comanda; `listarComissoes(c, barbeariaId, de, ate, barbeiroId?)`
- [ ] 5. API — rota: `GET /comissao?de=&ate=&barbeiroId=` com schema e permissão `financeiro.gerenciar`
- [ ] 6. API — fechamento: service `fecharComissao`, rota `POST /comissao/fechar`
- [ ] 7. Tela: `ComissaoView.vue` — filtro de período e barbeiro, tabela de comandas com origem rastreável, totais, botão fechar
- [ ] 8. Verificar: `pnpm verificar` e `pnpm verificar:tudo`
- [ ] 9. Revisar (`/code-review`), segurança (`security-review`) e commit

## Critérios de pronto

- Dono e Gerente conseguem ver a comissão devida por barbeiro num período
- Dono consegue fechar o período (marcar como pago), com registro histórico
- `pnpm verificar:tudo` verde
- PR aberto e revisado

## Riscos e pendências

- **Produtos com comissão própria** (`produtos.comissao`): hoje ignorados; se o dono quiser taxa diferente por produto, vira uma segunda fase
- **Produtos com comissão própria** (`produtos.comissao`): hoje ignorados; se o dono quiser taxa diferente por produto, vira uma segunda fase

## Estimativa

~7h de trabalho efetivo (5h sem fechamento de período, +2h com).

## Registro de mudanças

- 2026-11-12: planejamento criado a partir da conversa com o assistente; aguardando decisão de base de cálculo para iniciar.
