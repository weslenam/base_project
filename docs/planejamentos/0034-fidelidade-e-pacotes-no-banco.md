# Planejamento 0034: Fidelidade e pacotes no banco, com resgate na comanda

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** planejamentos 0015 (regras de fidelidade e pacotes), 0019 (parte 3) e 0025 (F4); ADRs 0001, 0010, 0011 e 0014
- **Commits:** ainda não commitado

## Solicitação de origem

> a fidelidade esta funcionando? pode commitar

> isso pode implementar

> ok pode commitar e executar

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente
  > pode implementar os pacotes (2026-11-09, início da etapa B)

> barbeiro não pode mesmo vender pacote ele pode direcinoar e pedir para alguem vender o pacote para ele (2026-11-09)

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
- [x] B1. Migração de pacotes e assinaturas e API, com testes de integração.
- [x] B2. Front de pacotes e "Renovar"; semente; layout; commit.

### Detalhe da etapa B (2026-11-09)

**O que existe hoje:** as regras estão no domínio (`pacotes.js`: `validarPacote`, `vigenciaDoPacote`, `saldoDoPacote`, `podeUsarPacote`, `renovarAssinatura`), e as telas (Pacotes, Vender pacote, pacotes no cliente e "usar pacote" na comanda) já funcionam, mas só na versão em memória. Pela API, o caixa recusa item de pacote ("Pacotes ainda não estão disponíveis"). Não há botão "Renovar".

- **Migração `..._pacotes.sql`:**
  - `pacotes` (nome único por barbearia, preço, tipo, `validade_dias`, `intervalo_minimo_dias`, `maximo_por_semana`, `excluido_em`) e `pacote_itens` (serviço, quantidade ou livre);
  - `assinaturas` (cliente, pacote, estado `aguardando_pagamento | ativa | cancelada`, `inicio`, `fim`, `comanda_venda_id`, `renovacao_de`);
  - `usos_assinatura` (assinatura, serviço, data, comanda), só inserção, com índice único por (comanda, assinatura, serviço, ordem) para receber duas vezes não duplicar;
  - RLS por barbearia nas quatro, como na fidelidade.
- **API (módulo `pacotes`):**
  - `GET/POST/PUT/DELETE /api/pacotes` com `pacotes.gerenciar` (o `GET` também com `pacotes.vender` ou `caixa.operar`, para vender e usar). Excluir é lógico e é recusado com cliente em vigor.
  - `GET /api/clientes/:id/assinaturas`: pacotes do cliente com saldo e "em vigor".
  - `POST /api/assinaturas` (vender) e `POST /api/assinaturas/:id/renovar`, com `pacotes.vender`: abrem uma comanda no caixa aberto com o item "Pacote: <nome>" (preço do catálogo) e criam a assinatura aguardando pagamento.
  - `POST /api/assinaturas/:id/pode-usar`: a pré-checagem da comanda.
  - Na comanda: o item com `assinaturaId` vira o serviço a R$ 0, conferido com `podeUsarPacote` ao salvar e de novo ao receber, com a assinatura travada (`for update`).
  - `receberComanda` grava os usos, ativa a assinatura vendida (vigência a partir do dia do pagamento) e aplica a renovação. `cancelarComanda` cancela a assinatura que aguardava aquela comanda.
- **Domínio:** a função que decide o início do novo ciclo na renovação (ver dúvida 1), com teste.
- **Front:**
  - `apiHttp` passa a usar as rotas: sai o `base` dos pacotes;
  - botão "Renovar" no pacote mensal do cliente, que abre a comanda no caixa como a venda;
  - a versão em memória espelha a renovação (é o dublê dos testes de tela).
- **Semente:** os 2 pacotes dos dados de exemplo do front ("Clube do corte", mensal; "4 cortes", 60 dias) e o Diego com o Clube em vigor.
- **Testes de integração:** venda entra no caixa e ativa ao pagar; uso respeita quantidade, intervalo e semana; dois recebimentos simultâneos não usam duas vezes; renovação estende a vigência; cancelar a comanda cancela a venda; módulo inativo dá 403; RLS isola as barbearias; pacote de outro cliente é recusado.

**Decisões propostas (para aprovar):**

1. **Início do ciclo renovado:** se o pacote ainda está em vigor, o novo ciclo começa no dia seguinte ao fim do atual (o cliente não perde dias); se já venceu, começa no dia do pagamento.
2. **Só o pacote mensal renova.** O de compra única com validade é vendido de novo.
3. **Uma renovação pendente por vez:** com uma comanda de renovação aberta, o botão vira "Aguardando pagamento".
4. **Quem usa o pacote na comanda:** quem tem `caixa.operar` (o Barbeiro incluído, já que ele recebe). Vender e renovar continuam com `pacotes.vender`. A descrição de `pacotes.vender` muda para "Vender e renovar pacotes".
5. **Editar um pacote já vendido:** nome, serviços e limites valem também para quem já comprou; o preço novo vale só nas próximas vendas e renovações (a comanda guarda o preço do momento).
6. **Sem crédito retroativo** e sem cobrança automática, como no plano.

- [x] C. Fechar: a memória (`api.js`) fica só como dublê dos testes de tela e espelha o contrato da API; índices e plano 0019 parte 3.

## Registro de mudanças

- 2026-11-08: criado depois da entrevista (6 perguntas).
- 2026-11-08: mini-spec aprovado ("ok pode commitar e executar").
- 2026-11-09: detalhe da etapa B escrito a partir de "pode implementar os pacotes". Esclarecimento: o Barbeiro não vende nem renova (pede a quem pode). Perguntas: quem usa o pacote na comanda → **Barbeiro também** (quem tem `caixa.operar`); demais decisões (1, 2, 3, 5 e 6) → **aprovadas**.
- 2026-11-09: **etapa B concluída.**
  - **Migração `20261109140000_pacotes.sql`:** `pacotes` (exclusão lógica, nome único entre os não excluídos), `pacote_itens`, `assinaturas` (cada renovação é uma linha nova com `renovacao_de`; índice único garante uma renovação por ciclo) e `usos_assinatura` (só inserção), todas com RLS.
  - **Desvio do plano:** `usos_assinatura` ficou sem o índice único por comanda. Receber duas vezes já é barrado pela comanda travada (estado `paga`), e o gasto duplo entre comandas diferentes é barrado travando as assinaturas antes de reler os usos (teste de concorrência).
  - **Domínio:** `cicloDaRenovacao` (decisão 1).
  - **API:** `GET/POST/PUT/DELETE /api/pacotes`, `GET /api/clientes/:id/assinaturas`, `POST /api/assinaturas` (vender), `POST /api/assinaturas/:id/renovar` e `POST /api/assinaturas/:id/pode-usar`. A comanda aceita o item `pacote` (preço do catálogo) e o serviço com `assinaturaId` (R$ 0), conferido ao salvar e ao receber. Ao receber, a venda só ativa se a comanda ainda cobra o pacote, para o mesmo cliente. Cancelar a comanda cancela a venda pendente.
  - **Permissões:** `pacotes.vender` virou "Vender e renovar pacotes"; usar na comanda é `caixa.operar` (o Barbeiro usa, não vende).
  - **Front:** `apiHttp` usa as rotas; "Renovar" no pacote mensal do cliente (o diálogo de venda com o pacote fixo); selo "Renovação aguardando pagamento" e "Começa em" para o ciclo futuro; a memória espelha a renovação.
  - **Testes:** domínio 117; integração 132 (11 novos); tela e dados com renovação; layout verde.
  - **Revisão (`/code-review`):**
    - corrigidos:
      - item de pacote aceito em qualquer comanda, cobrando sem entregar (issue #22): agora só entra pela venda ou renovação, e a comanda da venda pendente não perde o item nem troca de cliente;
      - datas da renovação calculadas pela API (`renovaEm`, `aComecar`), na data da barbearia;
      - nome repetido em corrida vira 409;
      - pacote buscado uma vez por comanda;
      - opção sem uso removida.
    - mantidos:
      - intervalo e limite semanal zeram a cada ciclo, como no domínio do 0015;
      - duas comandas abertas disputando o último uso: a segunda é recusada ao receber (pendência);
      - a versão em memória não espelha a recusa do item de pacote avulso (é dublê de tela).
  - **Achado na verificação visual:** datas puras aparecem um dia antes (`formatarData` lê como UTC). Bug antigo, registrado na issue #21 e corrigido à parte.
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
