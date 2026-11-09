# Planejamento 0034: Fidelidade e pacotes no banco, com resgate na comanda

- **Status:** Em andamento (etapa A)
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** planejamentos 0015 (regras de fidelidade e pacotes), 0019 (parte 3) e 0025 (F4); ADRs 0001, 0010, 0011 e 0014
- **Commits:** ainda não commitado

## Solicitação de origem

> a fidelidade esta funcionando? pode commitar

> isso pode implementar

> ok pode commitar e executar

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente
- **Contexto:**
  - O teste no navegador mostrou que salvar a fidelidade não persiste: só existia em memória, sem rota na API.
  - Comanda paga também não acumula selos nem cashback.
  - Pacotes e assinaturas estavam na mesma situação.
- **Esclarecimentos:**
  - Resgate → **acumular e resgatar** (o resgate é a fase 3 do 0015 e entra agora).
  - Renovação do pacote mensal → **botão "Renovar" no cliente**; a renovação entra no caixa como a venda.
  - Comandas pagas antes de ligar a fidelidade → **não contam**, só dali em diante.
  - Entrega → **duas etapas**: primeiro a fidelidade, depois pacotes e assinaturas.
  - Prêmio dos selos → **botão "Usar prêmio"** na comanda; o cliente pode guardar para outro dia.
  - Cashback → **quanto quiser, até o total da comanda**, gastando primeiro o crédito que vence antes.

## Objetivo

Fidelidade, pacotes e assinaturas passam a viver no banco, com RLS, e funcionam de ponta a ponta:

- a comanda paga credita selos e cashback;
- a comanda resgata o prêmio e o cashback;
- o pacote é vendido, usado no balcão e renovado.

O que hoje está em memória no front sai.

**Fora do escopo:**

- consulta pelo próprio cliente e avisos por e-mail ou WhatsApp (fase 2 do 0015);
- cobrança automática da renovação;
- crédito retroativo.

## Regras (as do 0015, mais as de resgate)

- **Acúmulo:**
  - ao **receber** a comanda, com o módulo ativo e cliente identificado, ela ganha 1 selo se tiver ao menos um serviço **pago** (o prêmio e o serviço de pacote, a R$ 0, não contam);
  - o cashback é a porcentagem sobre o **total pago** (depois do desconto e do cashback usado), arredondado para baixo no centavo;
  - os créditos herdam a validade configurada.
- **Prêmio:**
  - com o cartão completo (selos válidos ≥ necessários), a comanda oferece "Usar prêmio";
  - ao usar, entra o serviço do prêmio a R$ 0, marcado como prêmio;
  - ao receber, gasta os N selos (`resgate_selos`);
  - um prêmio por comanda.
- **Cashback:**
  - a comanda aceita "Usar cashback" de até `min(saldo, total)`;
  - o valor reduz o total a pagar e entra como `uso_cashback` ao receber;
  - o caixa só conta o que entrou em dinheiro, Pix ou cartão.
- **Conferência no servidor:**
  - na hora de receber, a API confere de novo o saldo, dentro da transação, com a comanda travada;
  - saldo que mudou é recusado com mensagem clara;
  - comanda cancelada não credita nem gasta nada.
- **Pacotes:**
  - venda e renovação geram uma comanda com o item "Pacote: <nome>" no caixa aberto;
  - o uso na comanda é o serviço a R$ 0 ligado à assinatura;
  - a regra "pode usar?" (intervalo e limite por semana) é conferida ao lançar e de novo ao receber, quando o uso é gravado.

## Desenho

- **Etapa A (fidelidade):**
  - **Migração:**
    - `fidelidade_config` (uma linha por barbearia; prêmio com chave estrangeira para `servicos`);
    - `fidelidade_movimentos` (só inserção: `cliente_id`, `tipo`, `valor`, `comanda_id`, `expira_em`);
    - colunas `premio_fidelidade` e `cashback_usado` em `comandas`;
    - RLS por barbearia.
  - **Domínio:**
    - `totalDaComanda` passa a considerar `cashbackUsado`;
    - regras de resgate `podeUsarPremio` e `limiteDeCashback`;
    - os créditos continuam em `creditosDaComanda`.
  - **API:**
    - `GET` e `PUT /api/fidelidade/config`;
    - `GET /api/clientes/:id/fidelidade` (saldo e extrato);
    - a comanda aceita `premioFidelidade` e `cashbackUsado`;
    - `receberComanda` grava os gastos e os créditos e devolve `creditos`;
    - tudo com permissões e módulo, conforme os ADRs 0010 e 0011.
  - **Front:**
    - a camada de dados (`apiHttp`) passa a usar as rotas;
    - a comanda ganha "Usar prêmio" e "Usar cashback" (design system);
    - o saldo real aparece no cliente e na comanda.
- **Etapa B (pacotes):**
  - **Migração:** `pacotes`, `assinaturas` e `usos_assinatura`, com RLS.
  - **API:**
    - CRUD de pacotes;
    - assinaturas do cliente, venda, renovação e "pode usar?";
    - o uso é gravado ao receber.
  - **Front:** a camada de dados e o botão "Renovar".
- **Semente:**
  - a barbearia modelo ganha a configuração de fidelidade e alguns pacotes de exemplo;
  - nada retroativo nas comandas da semente.

## Critérios de aceite

- **Integração (API):**
  - salvar a configuração persiste (recarregar mantém);
  - comanda paga credita selo e cashback;
  - a avulsa não credita;
  - o prêmio gasta os selos;
  - cashback acima do saldo é recusado;
  - o resgate e o crédito sobrevivem a duas requisições concorrentes sem gastar duas vezes;
  - módulo inativo dá 403;
  - a RLS isola uma barbearia da outra.
- **Pacotes:**
  - venda entra no caixa;
  - uso respeita o limite;
  - renovação estende a vigência.
- **Fluxo no navegador (Playwright), conferido de ponta a ponta:**
  - salvar a configuração e recarregar mantém;
  - pagar uma comanda soma o selo ao cliente.
- `pnpm verificar:tudo` e `pnpm verificar:layout` verdes.

## Etapas

- [x] A1. Migração da fidelidade e domínio (totais e regras de resgate), com testes.
- [x] A2. API da fidelidade e crédito e resgate no `receberComanda`, com testes de integração.
- [x] A3. Front: camada de dados, "Usar prêmio" e "Usar cashback" na comanda; semente; layout; commit.
- [ ] B1. Migração de pacotes e assinaturas e API, com testes de integração.
- [ ] B2. Front de pacotes e "Renovar"; semente; layout; commit.
- [ ] C. Fechar: a memória (`api.js`) fica só como dublê dos testes de tela e espelha o contrato da API; índices e plano 0019 parte 3.

## Registro de mudanças

- 2026-11-08: criado depois da entrevista (6 perguntas).
- 2026-11-08: mini-spec aprovado ("ok pode commitar e executar").
- 2026-11-08: **etapa A concluída.**
  - **Migração `20261108150000_fidelidade.sql`:**
    - `fidelidade_config` e `fidelidade_movimentos`, este só com inserção, sem `update` nem `delete`;
    - índice único por (comanda, tipo): receber duas vezes não duplica;
    - colunas `premio_fidelidade` e `cashback_usado` na comanda.
  - **Domínio:**
    - o saldo gasta primeiro o crédito que vence antes e só consome o crédito que existia na data do gasto (corrige saldo menor que o real quando sobrava parte de um crédito vencido);
    - `totalDaComanda` desconta o cashback usado;
    - `motivoParaUsarPremio`, `limiteDeCashback` e `motivoParaUsarCashback`.
  - **API:**
    - `GET` e `PUT /api/fidelidade/config`;
    - `GET /api/clientes/:id/fidelidade`;
    - a comanda aceita `premioFidelidade` e `cashbackUsado`, e o item do prêmio é montado pelo servidor;
    - `receberComanda` trava o cliente, confere o saldo de novo e grava os gastos e os créditos.
  - **Front:**
    - `apiHttp` usando as rotas;
    - a comanda ganha o bloco "Fidelidade", com "Usar prêmio", "Usar cashback (até R$ X)" e a linha do cashback no resumo.
  - **Desvio do plano:** a versão em memória não sai. Ela é o dublê dos testes de tela (`MODE=test`), então passou a espelhar o resgate. A etapa C foi reescrita.
  - **Testes:**
    - domínio: 101;
    - integração: 107 (9 novos, entre eles o gasto duplo simultâneo, recusado com 409);
    - tela: 128;
    - layout: 72.
  - **No navegador, conferido de ponta a ponta:** salvar e recarregar mantém, e uma comanda paga creditou 1 selo e R$ 1,50.
