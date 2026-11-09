# Planejamento 0010: Comanda com abas de serviço e produto e pagamento estilo PDV

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0008 (caixa e comanda) e 0009 (padrão PDV)
- **Commits:** 86155fb (branch `feat/caixa-comanda`)

## Solicitação de origem

> ficou bem boa a tela, precisamos agora atacar essa tela
>
> crie tab para serviço e adicone uma tab para produto dai temos q ter total em serviço e total em produto

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente, com captura de tela do diálogo "Comanda #4"
- **O que a captura mostrava:** um seletor único "Serviço ou produto", uma tabela só com os itens misturados (e um rodapé de paginação sem sentido) e só o total geral.
- **Contexto:** "ficou bem boa a tela" se refere ao detalhe do agendamento no estilo PDV (planejamento 0009); a comanda segue o mesmo padrão.

## Objetivo

Separar a comanda em abas **Serviços** e **Produtos**, cada uma com seu seletor, seus itens e seu total, e mostrar no resumo o **total em serviços**, o **total em produtos**, o desconto e o total. A separação também é a base da comissão, que tem percentuais diferentes para serviço e produto.

**Fora do escopo:** comissão, pagamento dividido em mais de uma forma e regras novas de caixa.

## Decisões e restrições

- **`DsAbas`** (novo): abas acessíveis (`tablist`, `tab`, `tabpanel`, setas do teclado), com `v-model` e `abas: [{ valor, rotulo }]`; o conteúdo de cada aba vai no slot `#<valor>`. É feito em HTML próprio com tokens, como `DsHorarios`, e tem contrato.
- **`DsEscolha`** (novo): escolha única em botões grandes (`aria-pressed`), usada para a forma de pagamento no lugar do seletor suspenso: um toque, como num PDV. Tem contrato.
- **`DsTabela`** ganha `semRodape`: mostra todas as linhas, sem paginação.
- **Domínio:** `totalDaComanda` passa a devolver também `servicos` e `produtos`, em centavos, como o resto.
- **Layout:** duas colunas. À esquerda, cliente, barbeiro e abas com os itens. À direita, o pagamento: resumo, desconto, forma de pagamento e as ações em `DsAcao` (Receber, Salvar aberta, Cancelar comanda). Abaixo de 48rem, as colunas empilham. Comanda paga ou cancelada fica só para leitura.

## Etapas

- [x] 1. Domínio: totais por tipo, com testes.
- [x] 2. `DsAbas`, `DsEscolha` e `DsTabela` com `semRodape`, com contratos, vitrine e README.
- [x] 3. Reescrever o `ComandaDialogo`.
- [x] 4. Testes de tela (totais por aba, receber escolhendo a forma) e `pnpm verificar`.

## Critérios de pronto

- Cada aba mostra só os itens do seu tipo e o seu total; o resumo mostra os totais de serviços e de produtos, que somados dão o subtotal.
- Receber escolhendo a forma de pagamento com um toque funciona, e as recusas continuam no diálogo de negação.
- `pnpm verificar` passa.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. `DsAbas` (4 testes de contrato), `DsEscolha` (4) e `semRodape` (1); 1 teste de domínio para os totais por tipo; 2 testes de tela (abas com totais, receber com um toque). `pnpm verificar` passa.
