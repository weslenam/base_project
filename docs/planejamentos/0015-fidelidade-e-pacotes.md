# Planejamento 0015: Módulos de fidelidade (selos e cashback) e pacotes

- **Status:** Em andamento
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** ADRs 0010 e 0011; planejamentos 0008 (comanda), 0013 (módulos) e 0001 (diferenciais: assinatura e fidelidade)
- **Commits:** 1e88d01 (fase 1; branch `feat/backend-acl-modulos`)

## Solicitação de origem

> outra coisa o sistema terá dois gadgets
>
> 1. controle de fidelidade
> 2. controle de pacotes - pacotes pode ser livres de quantidade ou por quantidade isso criará um controle de serviços realizados

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Inclusos ou adicionais? → **Os dois adicionais.**
  - Como funciona a fidelidade? → "penso q podemos deixar opcional, selos ( que o cliente deverá ter um meio de consultar os selos ou receber seus selos, quando usados e disponiveis) assim como cashback"
  - Como o pacote é vendido e renovado? → **Os dois tipos** (recorrente mensal e compra única com validade).
  - Limite do pacote livre? → "um mix dos tres durante a configuração do pacote" (sem limite, intervalo mínimo ou limite por semana, escolhido por pacote).

## Objetivo

Dois módulos adicionais (ADR 0011):

1. **Fidelidade.** A barbearia liga **selos**, **cashback** ou os dois.
   - **Selos:** um por comanda paga com serviço; com N selos, o cliente ganha um serviço de prêmio.
   - **Cashback:** uma porcentagem do valor pago vira crédito, com validade.
   - O cliente consulta o saldo e é avisado quando ganha ou usa.
2. **Pacotes.** A barbearia monta pacotes de serviços, com estas opções:
   - **por quantidade** (ex.: 4 cortes) ou **livres** (sem quantidade);
   - **recorrente mensal** (renova a cada mês e zera o saldo) ou **compra única com validade**;
   - limite de uso combinável: **sem limite**, **intervalo mínimo** entre usos ou **máximo por semana**.

   O uso na comanda registra os **serviços realizados** de cada pacote.

## Fases

1. **Núcleo (esta entrega):**
   - módulos e permissões no catálogo, com migração das permissões para as barbearias existentes;
   - regras de domínio puras e testadas;
   - telas de configuração (Fidelidade, Pacotes);
   - vender pacote ao cliente e ver o saldo dele;
   - na comanda, **usar o pacote** (o serviço sai por R$ 0 e entra no controle de uso) e **creditar selos e cashback** ao receber.
2. **Cliente consulta e é avisado (próxima):**
   - página "Meus selos e pacotes", acessada pelo link da barbearia com código de verificação enviado ao cliente;
   - avisos ao ganhar ou usar selos e cashback e quando um pacote vence.

   Depende de um canal verificado: e-mail (módulo de lembretes) ou WhatsApp (módulo adicional). Sem verificação, qualquer pessoa com o telefone veria os dados (LGPD).

3. **Resgates (próxima):** usar o prêmio de selos e o saldo de cashback como pagamento na comanda.
4. **API real:** junto com a fase 3 do planejamento 0013.

## Decisões e restrições

- **Módulos `fidelidade` e `pacotes`, os dois `adicional`.** Permissões novas, todas valendo só com o módulo ativo:
  - `fidelidade.gerenciar` (configurar);
  - `pacotes.gerenciar` (montar pacotes);
  - `pacotes.vender` (vender e usar no balcão).

  Os papéis padrão as recebem assim: Dono todas; Gerente todas; Recepção só `pacotes.vender`. A migração atualiza as barbearias que já existem (ADR 0010).

- **Selos:** só ganha selo a comanda **paga** com ao menos um serviço **pago** (o serviço usado por pacote não conta) e com cliente identificado (o avulso não acumula). Um selo por comanda. Opcional: os selos vencem depois de X meses.
- **Cashback:** a porcentagem incide sobre o **total pago** da comanda (depois do desconto) e é creditada só com cliente identificado. Cada crédito tem validade em dias.
- **Pacote:**
  - cada item é `{ servico, quantidade | livre }`;
  - vigência: recorrente = 1 mês a partir da compra, renovável; único = `validadeDias` a partir da compra;
  - **limite de uso, configurável e combinável:** `intervaloMinimoDias` entre usos do mesmo serviço e/ou `maximoPorSemana`; sem nenhum dos dois, é sem limite;
  - a regra "pode usar?" devolve o motivo em pt-BR quando recusa (ex.: "Próximo uso de Corte liberado em 14/11"), mostrado no diálogo de negação.
- **Uso do pacote na comanda:** o item do serviço fica com preço R$ 0 e marca o pacote usado; ao receber a comanda, o uso entra no histórico do pacote.
- **Venda de pacote:** pelo cadastro do cliente ("Vender pacote"). O pagamento da venda entra no caixa como uma comanda com o item "Pacote: <nome>".
- **Dados:** como as demais telas de negócio, ficam nos dados de exemplo até a migração para a API. A semente de desenvolvimento ativa os dois módulos na barbearia modelo, como se a contratação tivesse sido confirmada.

## Etapas

- [x] 1. Catálogo: módulos, permissões, papéis padrão e migração de permissões; ADR 0011 atualizado.
- [x] 2. Domínio: `fidelidade.js` (créditos e saldo) e `pacotes.js` (vigência, saldo, "pode usar?"), com testes.
- [x] 3. Dados de exemplo e API em memória: configuração da fidelidade, pacotes, assinaturas e extrato.
- [x] 4. Telas Fidelidade e Pacotes (configuração), com menu condicionado ao módulo e à permissão.
- [x] 5. Cliente: saldo de selos, cashback e pacotes, e "Vender pacote".
- [x] 6. Comanda: "Usar pacote" no serviço e crédito de selos e cashback ao receber.
- [x] 7. Testes de tela, README e `pnpm verificar` / `verificar:tudo`.

## Critérios de pronto

- Pacote por quantidade acaba no último uso; pacote livre respeita o intervalo e o máximo semanal; pacote vencido é recusado com o motivo.
- Receber uma comanda paga credita um selo e o cashback configurado ao cliente; o avulso não acumula.
- Sem o módulo ativo, as telas e as ações somem do menu e da comanda.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Fase 1 (núcleo) concluída. Testes: 15 de domínio (créditos, saldo, vigência, quantidade, intervalo, máximo semanal, os dois limites juntos, renovação), 8 de dados (módulo inativo não credita, avulso não acumula, uso de pacote por R$ 0 sem selo, pacote de outro cliente, venda que só vale depois de paga, cancelamento da venda, validações) e 7 de tela (menu por módulo, lista de pacotes, negação de configuração, saldo no cliente, usar pacote e negação por intervalo, crédito ao receber). Integração da API passando com a migração de permissões.
- 2026-11-07: Regra ajustada durante a execução: **só item do tipo serviço** dá selo. A venda de pacote (item "Pacote: …") não dá.
- **Pendentes:** fase 2 (consulta pelo cliente com código de verificação e avisos ao ganhar ou usar), fase 3 (resgate do prêmio e do cashback na comanda), renovação de pacote recorrente pela tela (a regra `renovarAssinatura` já existe) e a migração para a API real.
