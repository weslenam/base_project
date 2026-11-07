# Planejamento 0007: Equipe, serviços e produtos em telas separadas

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0001 (MVP, itens 5 e 6) e 0006
- **Commits:** ainda não commitado (branch `feat/componentes-mvp`)

## Solicitação de origem

> ok precisamos segmentar, equipe, produto e serviço

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:** nenhum. O pedido veio logo depois da tela combinada "Serviços e equipe" (planejamento 0006), e foi entendido como separá-la em três telas, incluindo o cadastro de produtos, que ainda não existia.

## Objetivo

Trocar a tela "Serviços e equipe" por três telas no menu: **Equipe** (`/equipe`), **Serviços** (`/servicos`) e **Produtos** (`/produtos`, nova). O cadastro de produtos prepara a comanda (MVP, item 5) e a comissão por produto (item 6).

**Fora do escopo:** controle de estoque (fora do MVP, conforme a definição do produto), a comanda, o caixa e o cálculo de comissões.

## Decisões e restrições

- **Produto:** nome, preço de venda e comissão do barbeiro (%) sobre a venda. Nome repetido é negado. Enquanto não houver comanda, nenhum vínculo impede a exclusão, que passa só pela confirmação.
- **Uma tela por cadastro**, com o mesmo padrão: `DsPagina` com o botão "Novo…", `DsTabela` e diálogo de edição com Excluir, Cancelar e Salvar.
- **Ícones novos no catálogo:** `equipe` e `produto`.
- A rota `/servicos` continua existindo, agora só com serviços.

## Etapas

- [x] 1. `api.produtos` (listar, salvar, excluir) com dados de exemplo e testes.
- [x] 2. Ícones `equipe` e `produto`.
- [x] 3. Telas `EquipeView`, `ServicosView` e `ProdutosView` (+ `ProdutoDialogo`); remover `ServicosEquipeView`.
- [x] 4. Rotas e menu; testes de tela; README; `pnpm verificar`.

## Critérios de pronto

- As três telas abrem pelo menu, cada uma com cadastro, edição e exclusão.
- Produto com nome repetido mostra o diálogo de negação.
- `pnpm verificar` passa.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. 3 testes de dados de produtos e 4 de tela novos (equipe, produtos e menu); `pnpm verificar` passa.
