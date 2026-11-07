# Planejamento 0008: Caixa e comanda

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0001 (MVP, item 5), 0006 e 0007; comissão (item 6) depende deste
- **Commits:** 26685a3 (branch `feat/caixa-comanda`, a partir de `feat/componentes-mvp`)

## Solicitação de origem

> pode avançar com outras implementacoes[

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:** nenhum. O pedido deixa a escolha com o assistente, que escolheu o item 5 do MVP (caixa e comanda). Ele usa os cadastros já feitos (serviços, produtos, equipe, agenda), e o controle de comissão, pedido "não agora" na mensagem anterior, depende dele.

## Objetivo

Registrar o que foi vendido em cada atendimento e conferir o caixa do dia, atendendo ao critério do MVP: **o fechamento do dia bate com a soma das comandas por forma de pagamento**.

**Fora do escopo:** cálculo e fechamento de comissões, NFS-e, estoque, sangria e suprimento, pagamento dividido em mais de uma forma e API/banco reais (os dados continuam de exemplo, como no planejamento 0006).

## Decisões e restrições

- **Comanda:** cliente (opcional, "cliente avulso"), barbeiro, itens (serviços e produtos, com quantidade), desconto em reais e uma forma de pagamento (dinheiro, Pix, débito, crédito). Estados: `aberta`, `paga` e `cancelada`.
- **Cada item guarda o barbeiro e o preço do momento da venda**, para a comissão futura não depender de preços que mudaram depois.
- **Cálculos em centavos** (inteiros) na lib `dominio`, sem erro de arredondamento: total da comanda e resumo do caixa por forma de pagamento.
- **Caixa por dia:** abrir (com troco inicial), receber comandas e fechar com o dinheiro contado. O sistema compara com o esperado (troco inicial mais as vendas em dinheiro).
- **Diálogos (planejamento 0006):**
  - **Negação:** nova comanda com o caixa fechado, receber comanda sem itens ou sem forma de pagamento, desconto maior que o subtotal, fechar o caixa com comanda em aberto.
  - **Advertência:** diferença entre o dinheiro contado e o esperado no fechamento.
  - **Confirmação:** cancelar comanda.
- **Integração com a agenda:** um agendamento atendido ganha o botão "Abrir comanda", que já traz cliente, barbeiro e serviço.

## Etapas

- [x] 1. `dominio/caixa.js`: formas de pagamento, total da comanda e resumo do caixa, em centavos, com testes.
- [x] 2. Dados: caixa e comandas de exemplo; `api.caixa` (obter do dia, abrir, fechar) e `api.comandas` (listar, obter, salvar, receber, cancelar, abrir a partir de agendamento), com testes.
- [x] 3. Tela **Caixa** (`/caixa`): abrir caixa, resumo por forma de pagamento, lista de comandas, fechar caixa.
- [x] 4. **Comanda** em diálogo: itens, quantidade, desconto, forma de pagamento, total, salvar aberta, receber, cancelar.
- [x] 5. "Abrir comanda" no detalhe do agendamento atendido.
- [x] 6. Menu, testes de tela, README e `pnpm verificar`.

## Critérios de pronto

- A soma das comandas pagas por forma de pagamento aparece no fechamento e bate com o resumo (teste de domínio e de dados).
- Cada recusa listada acima mostra o diálogo de negação, e a diferença de dinheiro mostra a advertência.
- `pnpm verificar` passa.

## Riscos e pendências

- **Comissão (item 6):** a base está pronta, porque cada item da comanda guarda barbeiro, preço e quantidade da venda. Falta o cálculo, o fechamento por período e o relatório, pedidos para depois.
- **Pagamento dividido** (parte em Pix, parte em dinheiro), sangria e suprimento: fora do MVP; avaliar com barbearias reais.
- **Reabrir o caixa** no mesmo dia não é permitido. Se for preciso corrigir, a correção fica para um perfil de gerente (autenticação e papéis, fase 0).

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. 9 testes de domínio de caixa, 8 de dados de caixa e comanda e 5 de tela (resumo, negação ao receber sem forma, negação ao fechar com comanda aberta, advertência de diferença, agenda → comanda). `pnpm verificar` passa.
- 2026-11-07: O agendamento atendido também ganhou "Abrir comanda", não só o confirmado.
