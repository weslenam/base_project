# Planejamento 0027: Estoque, compras e financeiro (contas a pagar e a receber)

- **Status:** Concluído (parte 1 + fatia 2A PR #31 + fatia 2B commit 787a07b)
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** ADRs 0010 (papéis e permissões), 0011 (módulos), 0014 (proteção da API); planejamentos 0008 (caixa e comanda), 0020 (balcão) e 0026
- **Commits:** 787a07b (fatia 2B)

## Solicitação de origem

> implemente controle de estoque dos produtos (consumiveis e para revenda), contas a pagar e contas a receber e algum tipo de pedido de compra para podermos controlar oq estamos pedindo e ter previsão de pagamento

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente (entrevista `grill-me`)
- **Esclarecimentos:**
  - Como baixa o estoque? → "Os dois": revenda baixa sozinha na comanda paga; consumível tem ficha técnica opcional por serviço, baixa manual e inventário.
  - O que entra em contas a receber? → "Lançamento manual".
  - Como o pedido de compra anda? → "Só registro de compra": lança a compra já recebida, dá entrada no estoque e gera as contas a pagar.
  - Módulo ou incluso? → "Dois módulos separados": "Estoque e compras" e "Financeiro".
  - Venda de revenda com saldo zero? → "Vende e avisa": o estoque fica negativo, com alerta.
  - Custo do produto? → "Último custo".
  - Pagar com dinheiro da gaveta sai do caixa? → "Sim, se escolher 'dinheiro do caixa'".
  - Extras da primeira versão? → contas recorrentes, categorias, previsão (fluxo de caixa) e alerta de estoque mínimo.

## Objetivo

Dar à barbearia controle do que tem em estoque, do que comprou e do que vai pagar e receber:

- **Estoque:** saldo por produto (consumível ou revenda), com as entradas, saídas e ajustes registrados.
- **Compras:** registro de compra a fornecedor, com parcelas e vencimentos que viram contas a pagar.
- **Financeiro:** contas a pagar e a receber, recorrentes e por categoria, com uma previsão de fluxo de caixa.

**Fora do escopo:**

- pedido de compra com etapas (rascunho, enviado, recebido) e recebimento parcial;
- repasse de cartão e fiado em contas a receber;
- conciliação bancária, boleto e integração com banco;
- nota fiscal de entrada;
- custo médio;
- comissão sobre produto (já existe o campo, mas o cálculo é de outro planejamento).

## Mini-spec

### Módulos e permissões (ADRs 0010 e 0011)

- **Módulo `estoque` ("Estoque e compras"):** adicional.
  - Permissão `estoque.ver`: Recepção, Gerente e Dono.
  - Permissão `estoque.gerenciar`: Gerente e Dono. Cobre movimentar, inventário, fornecedores, compras e ficha técnica.
- **Módulo `financeiro` ("Financeiro"):** adicional.
  - Permissão `financeiro.gerenciar`: Gerente e Dono. Cobre contas, categorias, recorrências e previsão.
- **As permissões dependem do módulo:** sem o módulo ativo, as telas somem do menu e as rotas devolvem 403, como nos módulos de fidelidade e pacotes.
- **Compra sem o módulo Financeiro:** a compra guarda as parcelas, mas elas só aparecem em contas a pagar quando o Financeiro estiver ativo. Ativar o Financeiro depois mostra as parcelas em aberto.
- **Barbeiro:** não vê nada destes módulos.

### Produtos e estoque

- **Tipo do produto:** `revenda` (padrão para os produtos que já existem) ou `consumivel`.
  - Consumível não tem preço de venda, não aparece na comanda e não tem comissão.
  - Revenda continua como hoje.
- **Novos campos do produto:**
  - unidade: `un`, `ml`, `g`, `cx` ou `par`;
  - estoque mínimo;
  - último custo, atualizado a cada compra;
  - saldo atual, sempre igual à soma dos movimentos e nunca editado direto.
- **Quantidades:** decimais com até 3 casas, como 0,5 ou 12,25.
- **Movimentos de estoque:** cada um registra o tipo, a quantidade (com sinal), o custo unitário, quem fez, quando e a origem (comanda, compra, ficha ou ajuste). Os tipos são:
  - `compra` (+): entrada de uma compra;
  - `venda` (−): revenda na comanda paga;
  - `consumo_servico` (−): baixa pela ficha técnica na comanda paga;
  - `consumo_manual` (−): uso registrado à mão, com motivo;
  - `ajuste_inventario` (±): contagem física define o saldo novo, e o movimento é a diferença;
  - `estorno_compra` (−): compra cancelada.
- **Comanda paga:**
  - gera `venda` para cada produto de revenda;
  - gera `consumo_servico` para cada serviço com ficha técnica, multiplicado pela quantidade;
  - nunca é bloqueada por falta de saldo. O saldo pode ficar negativo, e aí aparece um alerta.
- **Ficha técnica:** é opcional por serviço. Cada linha diz quanto de um produto consumível o serviço gasta, como "Corte: lâmina 1 un, gel 10 ml".
- **Alerta de mínimo:** produto com saldo menor ou igual ao mínimo, ou negativo, entra na lista "Comprar" com a quantidade sugerida (mínimo × 2 − saldo).
- **Inventário:** recebe a lista de produtos com a quantidade contada e gera um ajuste para cada diferença.

### Fornecedores e compras

- **Fornecedor:** nome (obrigatório), CNPJ ou CPF (opcional, validado), telefone e observações. A exclusão é lógica.
- **Compra:**
  - **Campos:** fornecedor, data, itens (produto, quantidade, custo unitário), frete e desconto opcionais, e observação.
  - **Ao salvar:**
    1. dá entrada no estoque (`compra`) e atualiza o último custo de cada produto;
    2. gera as parcelas a pagar com o total (itens + frete − desconto).
  - **Formas de parcelar:** à vista (vencimento único) ou em N parcelas com intervalo em dias, como 30/60/90. As datas podem ser editadas antes de salvar.
  - **Categoria:** as parcelas da compra entram em "Compra de produtos".
  - **Edição:** não há. Para corrigir, cancela e lança de novo.
  - **Cancelar:** só se nenhuma parcela foi paga. Gera `estorno_compra` e cancela as parcelas em aberto.

### Financeiro

- **Conta:** `pagar` ou `receber`, com descrição, categoria, valor, vencimento e, opcionalmente, fornecedor (a pagar) ou cliente (a receber). A origem pode ser manual, compra ou recorrência.
- **Situações:** `aberta`, `paga`/`recebida` e `cancelada`. "Vencida" não é guardada: é calculada (aberta com vencimento anterior a hoje).
- **Baixa:**
  - registra a data, o valor pago (pode diferir do previsto por juros ou desconto) e a forma (`dinheiro_caixa`, `pix`, `banco`, `cartao` ou `outro`);
  - **`dinheiro_caixa`:** exige o caixa de hoje aberto e vira uma saída no caixa (sangria) que entra no fechamento como dinheiro esperado a menos. Num recebimento, vira uma entrada (suprimento);
  - **as demais formas** não mexem no caixa.
- **Estorno da baixa:** desfaz o pagamento e o movimento de caixa, mas só se esse caixa ainda estiver aberto.
- **Categorias:**
  - cadastro simples por barbearia, separado por tipo (pagar ou receber);
  - categorias iniciais: Aluguel, Energia, Água, Internet, Compra de produtos, Salários e pró-labore, Impostos e Outras despesas (a pagar); Aluguel de cadeira e Outras receitas (a receber);
  - categoria com conta não pode ser excluída, só desativada.
- **Recorrência:**
  - descrição, categoria, valor, dia do mês (1 a 28) e fornecedor opcional;
  - o sistema mantém geradas as contas dos próximos 3 meses, ao carregar a tela e ao salvar a recorrência;
  - encerrar a recorrência cancela as contas futuras em aberto;
  - mudar o valor afeta só as contas ainda não geradas.
- **Previsão (fluxo de caixa):**
  - períodos de 30, 60 ou 90 dias, agrupados por semana;
  - mostra a pagar, a receber e o saldo previsto do período;
  - lista à parte das vencidas;
  - totais por categoria.

### Telas

| Tela                                                                       | Rota                    | Módulo                                             |
| -------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------- |
| Produtos: tipo, unidade, mínimo, saldo e último custo                      | `/produtos` (existente) | base (campos de estoque só com o módulo `estoque`) |
| Estoque: saldos, alerta "Comprar", movimentos, consumo manual e inventário | `/estoque`              | `estoque`                                          |
| Fornecedores                                                               | `/fornecedores`         | `estoque`                                          |
| Compras: lista e nova compra com parcelas                                  | `/compras`              | `estoque`                                          |
| Ficha técnica, no diálogo do serviço                                       | `/servicos` (existente) | `estoque`                                          |
| Contas a pagar e a receber: abas, filtros, baixa e estorno                 | `/financeiro/contas`    | `financeiro`                                       |
| Recorrências e categorias                                                  | `/financeiro/cadastros` | `financeiro`                                       |
| Previsão                                                                   | `/financeiro/previsao`  | `financeiro`                                       |
| Caixa: saídas e entradas no resumo e no fechamento                         | `/caixa` (existente)    | base                                               |

As telas usam só os componentes `Ds*` (skill `design-system`). Um componente novo só é criado se faltar algum, por exemplo uma lista editável de parcelas.

### Dados (migração nova, com RLS em todas as tabelas, ADR 0009)

- **`produtos`:**
  - `tipo`, `unidade`, `estoque_minimo`, `ultimo_custo` e `saldo` (atualizado na mesma transação de cada movimento);
  - `preco` passa a ser obrigatório só para revenda.
- **Tabelas novas:**
  - de estoque: `movimentos_estoque`, `fichas_tecnicas`, `fornecedores`, `compras` e `itens_compra`;
  - do financeiro: `categorias_financeiras`, `contas` e `recorrencias`;
  - do caixa: `movimentos_caixa`.
- **Valores:** em `numeric(12,2)`, e as quantidades em `numeric(12,3)`.
- **Regras puras no `@barbertime/dominio`:**
  - saldo, sugestão de compra e baixa da ficha;
  - parcelas (divisão sem perder centavos);
  - datas da recorrência;
  - agrupamento da previsão;
  - efeito dos movimentos de caixa no resumo do caixa.

## Casos-limite

- **Arredondamento das parcelas:** 100 em 3 dá 33,33 + 33,33 + 33,34, com a diferença sempre na última.
- **Recorrência no fim do mês:** o dia do mês vai de 1 a 28, para não haver mês sem o dia escolhido.
- **Ficha técnica com produto que deixou de ser consumível ou foi excluído:** a linha é ignorada na baixa e aparece um aviso na ficha.
- **Comanda paga e cancelada depois:** hoje não existe. Comanda paga não se cancela, então não há estorno de venda.
- **Compra com produto excluído:** recusada.
- **Mudar o tipo do produto com saldo:** permitido, e o saldo continua.
- **Baixa com `dinheiro_caixa` sem caixa aberto:** recusada, com mensagem para abrir o caixa ou escolher outra forma.
- **Sem o módulo:** rotas com 403 e campos de estoque ocultos em Produtos. A comanda paga só gera movimentos quando o módulo `estoque` está ativo.

## Critérios de aceite

1. A revenda vendida na comanda paga baixa o saldo. O serviço com ficha baixa os consumíveis. Com saldo zero a venda passa, o saldo fica negativo e o produto aparece em "Comprar".
2. A compra de 3 itens em 2 parcelas (30/60) dá entrada no estoque, atualiza o último custo e cria 2 contas a pagar que somam o total.
3. Cancelar uma compra sem parcela paga estorna o estoque e cancela as parcelas. Com uma parcela paga, o cancelamento é recusado.
4. Pagar uma conta com `dinheiro_caixa` reduz o dinheiro esperado no fechamento do caixa de hoje. Estornar enquanto o caixa está aberto devolve o valor.
5. Uma recorrência no dia 10 gera as contas dos próximos 3 meses, e encerrá-la cancela as futuras em aberto.
6. A previsão de 30 dias soma a pagar e a receber por semana e lista as vencidas.
7. O inventário ajusta o saldo para o valor contado, com um movimento da diferença.
8. Com o módulo inativo, rotas com 403 e telas fora do menu. A Recepção vê o estoque mas não movimenta. O Barbeiro não vê nada destes módulos.
9. Há testes de domínio para cada regra pura, testes de integração para cada critério acima e testes de tela para os fluxos principais. `pnpm verificar:tudo` passa.

## Decisões e restrições

- **Saldo guardado em `produtos.saldo`** e atualizado na mesma transação de cada movimento, com `for update` no produto. A soma dos movimentos fica como auditoria e é conferida em teste.
- **Último custo** é o custo da compra mais recente, conforme o esclarecimento acima.
- **Candidatas a ADR:**
  - ADR 0021, "Estoque por movimentos com saldo materializado" (era 0018, número que ficou com o Business Center);
  - ADR 0019, "Movimentos de caixa (sangria e suprimento) vindos do financeiro".
  - Numeração ajustada em 2026-11-08: 0015 a 0017 ficaram para o Supabase (planejamento 0025).
- **Rotas novas seguem o ADR 0014:** parâmetros tipados, schema em todo corpo e mensagens em pt-BR.

## Detalhe da parte 2: financeiro (2026-11-09)

> entao vamos para a 0027 (2026-11-09, início da parte 2)

**O que já existe:** as tabelas `contas` (situação `aberta | quitada | cancelada`) e `categorias_financeiras`, e as parcelas que a compra gera. Ainda não há API, telas nem regras de recorrência, previsão e movimentos de caixa.

**Entrega em duas fatias (dois PRs):**

- **2A. Contas e caixa:**
  - **Domínio:** efeito dos movimentos de caixa no resumo (`resumoDoCaixa` ganha saídas e entradas, e o dinheiro esperado as considera) e situação "vencida" calculada.
  - **Migração:** `movimentos_caixa` (caixa, tipo `saida | entrada`, valor, descrição, conta de origem), mais `recorrencia_id` em `contas`, já pensando na 2B. Tudo com RLS.
  - **API (`financeiro.gerenciar` + módulo):**
    - listar contas com filtros (tipo, situação, vencidas, período);
    - criar conta manual, editar e cancelar a aberta;
    - baixa (data, valor pago, forma) e estorno;
    - CRUD de categorias, com desativação quando a categoria tem conta.
  - **Caixa:** a baixa com `dinheiro_caixa` vira saída (pagar) ou entrada (receber) no caixa de hoje. O estorno desfaz, mas só com aquele caixa ainda aberto. A tela do caixa e o fechamento mostram as linhas "Saídas" e "Entradas".
  - **Telas:** `/financeiro/contas` (abas Pagar e Receber, filtros, nova conta, baixa e estorno), categorias, menu "Financeiro" e a versão em memória.
- **2B. Recorrências e previsão:**
  - **Domínio:** datas da recorrência (dia de 1 a 28, próximos 3 meses) e agrupamento da previsão por semana.
  - **Migração:** `recorrencias`.
  - **API:** CRUD de recorrências, com geração das contas ao salvar e ao listar; encerrar cancela as futuras em aberto; previsão de 30, 60 ou 90 dias.
  - **Telas:** `/financeiro/cadastros` (recorrências e categorias) e `/financeiro/previsao`.
  - **Fechamento:** ADRs 0019 e 0021 e os índices.

**Decisões propostas (para aprovar):**

1. **Duas fatias (2A e 2B), um PR cada.** A 2A já entrega valor sozinha: pagar e receber contas e ver isso no caixa.
2. **Quem mexe:** só quem tem `financeiro.gerenciar` (Gerente e Dono), como no mini-spec. A Recepção não paga conta, nem com o dinheiro da gaveta.
3. **Estorno de baixa feita sem `dinheiro_caixa`** (Pix, banco, cartão, outro): pode ser feito a qualquer momento, porque não mexe no caixa.
4. **O Business Center não conta o financeiro:** a receita da plataforma continua sendo só a das comandas. Contas a receber manuais não entram.
5. **Editar uma conta aberta:** descrição, categoria, valor e vencimento. A parcela de compra só muda o vencimento; o valor dela vem da compra.

## Etapas

- [x] 1. Aprovação do mini-spec pelo Weslen.
- [x] 2. Domínio: módulos e permissões novos, mais as regras de estoque, parcelas, recorrência, previsão e caixa, com testes. _(`datasDeRecorrencia`, `agruparPrevisaoPorSemana` na 2B.)_
- [x] 3. Migração: tabelas, RLS, campos de produto e categorias iniciais. _(`20261111000000_recorrencias.sql` na 2B: tabela `recorrencias` + `recorrencia_id` em `contas`.)_
- [x] 4. API de estoque: produtos, movimentos, inventário, ficha técnica e baixa na comanda paga.
- [x] 5. API de compras e fornecedores, gerando as parcelas.
- [x] 6. API do financeiro: contas, baixa e estorno com caixa, categorias, recorrências e previsão. _(Recorrências e previsão na 2B.)_
- [x] 7. Caixa: saídas e entradas no resumo e no fechamento. _(Fatia 2A.)_
- [x] 8. Telas: produtos, estoque, fornecedores, compras, ficha técnica, contas, cadastros, previsão e caixa, mais menu e rotas. _(`CadastrosView` com abas, `RecorrenciaDialogo` e `PrevisaoView` na 2B.)_
- [x] 9. Testes de integração e de tela dos critérios de aceite. _(Critérios 5 e 6 adicionados na 2B.)_
- [x] 10. ADRs 0019 e 0021 e índices.
- [x] 11. `pnpm verificar:tudo`, `/code-review`, `security-review` e commit.

## Riscos e pendências

- **Tamanho:** é o maior planejamento até aqui. Pode ser entregue em duas partes: primeiro estoque e compras (etapas 2 a 5 e a parte de estoque da 8), depois o financeiro.
- **Supabase (planejamento 0025):** as tabelas novas entram na migração para o Supabase e precisam seguir o mesmo padrão de RLS.
- **Dados de exemplo (`api.js` em memória):** precisam acompanhar a mudança, para os testes de tela.

## Registro de mudanças

- 2026-11-08: documento criado a partir da entrevista (duas rodadas).
- 2026-11-09: detalhe da parte 2 aprovado ("esta aprovado pode começar pela 2A"): decisões 1 a 5 como propostas; começa pela fatia 2A.
- 2026-11-09: **fatia 2A implementada** (branch `feat/0027-financeiro`):
  - **Migração `20261109160000_movimentos_caixa.sql`:** `movimentos_caixa` (estorno marca `estornado_em`; uma baixa válida por conta), com RLS e chaves compostas por barbearia. `recorrencia_id` em `contas` ficou para a 2B, junto com a tabela `recorrencias`.
  - **Domínio:** `resumoDoCaixa` com saídas e entradas; `situacaoDaConta`, `validarConta`, `validarBaixa`, `movimentoDaBaixa` e `totaisDasContas`.
  - **API:** `/api/financeiro/categorias` (CRUD; com conta, só desativa) e `/api/financeiro/contas` (filtros, lançar, editar, cancelar, baixar, estornar). Dinheiro do caixa sem data usa o dia da barbearia.
  - **Telas:** `/financeiro/contas` (filtros Tipo e Situação, totais, conta, baixa e estorno) e `/financeiro/cadastros` (categorias); menu "Financeiro"; linhas "Saídas" e "Entradas" no caixa e no fechamento. Ícones novos `financeiro` e `categoria`.
  - **Fora da 2A:** escolher cliente na conta a receber (a API aceita; a tela fica para depois); as parcelas de compra não aparecem na versão em memória.
  - **Semente:** módulo Financeiro ativo na barbearia modelo, com três contas de exemplo.
  - **Revisão (`/code-review`):** corrigidos #25 (categoria padrão voltava), #26 (Business Center sem as saídas na gaveta), #27 (conta de fornecedor excluído não editava), #28 (baixa e fechamento ao mesmo tempo: caixa travado; o teste é de guarda, a corrida não se reproduz de forma confiável), #29 (valor enorme dava 500) e #30 (texto do estorno e resposta fora de ordem). Mantidos: data padrão da baixa vem do aparelho (o campo é editável; dinheiro do caixa usa a data da barbearia); a lista corta em 500 contas (pendência); `:id` já é tipado pela guarda global.
  - **Testes:** domínio 124; integração 146; tela 8 do financeiro; layout 89.
- 2026-11-11: **fatia 2B implementada** (branch `main`, pendente commit):
  - **Migração `20261111000000_recorrencias.sql`:** tabela `app.recorrencias` (tipo, descrição, categoria, valor, dia 1–28, fornecedor opcional, `encerrada_em`) + `recorrencia_id` em `contas`, com RLS e FK composta por barbearia.
  - **Domínio:** `datasDeRecorrencia` (próximas 3 datas de um dia fixo) e `agruparPrevisaoPorSemana` (agrupa contas abertas por semana ISO, separa vencidas), com testes.
  - **API:** `GET/POST /financeiro/recorrencias`, `PUT /financeiro/recorrencias/:id`, `POST /financeiro/recorrencias/:id/encerrar` e `GET /financeiro/previsao?dias=`. Geração idempotente de 3 contas por recorrência. Encerrar cancela contas futuras abertas.
  - **Telas:** `CadastrosView` refatorado com abas Categorias + Recorrências; novo `RecorrenciaDialogo` (criar/editar/encerrar); nova `PrevisaoView` (indicadores, tabela por semana e por categoria, seletor de período 30/60/90 dias). Router atualizado: "Categorias" → "Cadastros" + rota `/financeiro/previsao`.
  - **ADRs 0019** (recorrências e previsão) **e 0021** (estoque por movimentos) escritos.
- 2026-11-08: parte 1 (estoque e compras) implementada, ainda sem commit. `pnpm verificar:tudo` passou (476 testes: 398 de unidade e de tela, 78 de integração). Desvios do mini-spec:
  - **Validação de CPF/CNPJ do fornecedor:** nova regra pura `documentoValido` no `@barbertime/dominio`, usada pela API, pelo fake e pela tela.
  - **Categorias iniciais:** criadas sob demanda (`garantirCategoriasPadrao`) na primeira compra com valor, não na migração. As tabelas `recorrencias` e `movimentos_caixa` ficam para a migração da parte 2.
  - **`GET /estoque`** devolve `{ produtos, comprar }`, com a sugestão de compra já calculada.
  - **`receberComanda`** ganhou um 4º parâmetro opcional `{ barbeariaId, usuarioId }`. Sem ele, a comanda é paga sem baixa de estoque.
  - **Ficha técnica:** salva pelo botão "Salvar" do diálogo do serviço, e só quando muda. O `PUT` substitui a ficha inteira.
  - **Menu:** as telas novas ficam no grupo "Estoque" (Estoque, Compras e Fornecedores).
  - **Estoque mínimo em Produtos:** o campo só aparece com o módulo ativo. Tipo e unidade aparecem sempre.
- Pendências da parte 1:
  - cancelar uma compra cujo produto foi excluído depois falha com "Produto não encontrado", porque o estorno trava só produto ativo. Falta decidir se o estorno deve valer também para produto excluído;
  - a regra "consumível fora da comanda" não tem teste de tela próprio. Está coberta no backend (`normalizarItens`) e pelo filtro do `ComandaDialogo`;
  - falta `/code-review`, `security-review` e o commit.
- 2026-11-08: ajustes depois do `/code-review` da parte 1:
  - **Estorno de compra** vale também para produto excluído depois (`incluirExcluido`), com teste.
  - **`GET /produtos`** só devolve custo e saldo para quem tem `estoque.ver`.
  - **Travas** dos produtos sempre na ordem do id (comanda, compra e estorno), para não haver impasse.
  - **Compra sem fornecedor** dá 400.
  - **Cancelar a compra** devolve o último custo ao da compra válida anterior.
  - **Produto em comanda aberta** não vira consumível.
  - **Diálogo do serviço:** confere a ficha antes de salvar e não duplica o serviço ao tentar de novo.
  - **Fora desta rodada** (registrado): divergências menores do fake (`api.js`) no inventário com produto repetido e na data da parcela, e a trava dupla no inventário.
  - **Resultado:** `pnpm verificar:tudo` verde, com 83 testes de integração.
