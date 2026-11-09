# Planejamento 0020: Balcão: atendimento rápido (avulso + agendado), fila e operação pelo barbeiro

- **Status:** Fase 1 concluída: aguardando o teste do usuário para decidir as próximas fases
- **Data:** 2026-11-07
- **Solicitado por:** weslenam
- **Relacionado:** especificação [docs/atendimento/balcao.md](../atendimento/balcao.md); planejamentos 0009, 0010, 0012, 0015 e 0019; ADRs 0010, 0011 e 0013
- **Commits:** ainda não commitado

## Solicitação de origem

> temos que achar uma forma do sistema se adaptar para o barbeiro porque normalmente no dia a dia o proprio barbeiro pode fazer o fechamento não tem alguem para fazer o atendimento eventualmente o dono faz mas não é o padrão então temos que trabalhar com agendamento e encaixe (avulso - que cadastramos em seguida) havia algo como fila nos sistemas concorrentes podemos fazer o mesmo

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente (durante o planejamento 0019)

### Solicitações relacionadas

> baixe o drive o balcao.md para implementarmos

> inclui nos documento acesse-o

> dentro da pasta docs/atendimento do projeto

(2026-11-07) A especificação do usuário está em **`docs/atendimento/balcao.md`** e é a fonte deste plano. Onde este plano e a especificação divergirem, vale a especificação, salvo decisão registrada abaixo.

## Objetivo

Implementar o **Balcão**: um PDV de atendimento rápido em que o avulso (sem horário) e o agendado seguem o mesmo caminho. Inclui:

- **Fila presencial.**
- **Encaixe** que não atropela quem agendou.
- **Check-in.**
- **Visão do barbeiro no celular**, já que na maioria das barbearias o próprio barbeiro atende e fecha.
- **Fechamento** no caixa do dia.

A promoção de horário vazio, o Pix sem maquininha e o modo offline entram em fases próprias (abaixo).

## Decisões (da especificação e de ajuste ao que existe)

1. **Entidade única `atendimento`** (especificação): agenda e fila são visões do mesmo dado.
   - A tabela `agendamentos` do 0019 evolui para `atendimentos`, com o ciclo de vida da especificação: `agendado → chegou → em_atendimento → finalizado → pago`, `na_fila → em_atendimento`, e as saídas `desistiu`, `no_show` e `cancelado`.
   - A "confirmação de presença" atual vira um atributo (`confirmado_em`), não um status.
   - **Bloqueios** (almoço, folga) saem para uma tabela própria, porque não são atendimento.
2. **A comanda nasce no check-in ou na entrada na fila** (especificação). Isso substitui a parte 2 do 0019: caixa e comandas vão para o banco já ligados ao atendimento.
3. **O avulso nunca rouba o horário de quem agendou.** O encaixe usa:
   - `janela = próximo agendado − (agora ou fim do atual)`;
   - `pode agora = livre E janela ≥ duração + folga`;
   - **folga** de 5 min e **tolerância** de 10 min, configuráveis em Configurações (ADR 0012).
4. **Prioridade da fila:**
   1. agendado que chegou dentro da tolerância;
   2. avulsos por ordem de chegada;
   3. agendado atrasado além da tolerância, que perde a vez.
5. **Fila só presencial.** O QR na porta só faz check-in de quem agendou (especificação).
6. **Um caixa do dia por barbearia**, com avulsos e agendados juntos. Qualquer barbeiro com permissão de caixa recebe.
   - Isso pede permissões novas para o papel Barbeiro: `atendimento.operar_proprio` (iniciar, finalizar e lançar na própria comanda) e receber.
7. **Tempo real:** o balcão e o celular do barbeiro atualizam sozinhos.
   - Fase 1: atualização periódica curta.
   - Fase 2: SSE.

## Fases

- **Fase 1: Balcão no banco (o núcleo).**
  - Migração de `atendimentos`, `bloqueios`, `caixas`, `comandas` e itens.
  - API do ciclo de vida, encaixe e fila.
  - Tela **Balcão** em tela cheia para tablet, com três colunas:
    - **Agora:** barbeiros livre / ocupado / pausa.
    - **Fila e chegadas:** quem espera, com o tempo de espera.
    - **Próximos:** agendados das próximas 2–3 h, com Check-in.
  - **"+ Avulso" em até 3 toques:** serviço → barbeiro ("Primeiro livre") → WhatsApp opcional ou "Cliente balcão".
  - Comanda aberta desde a fila e cobrança com as formas atuais (dinheiro, Pix registrado manualmente, cartão).
  - Agenda e caixa passam a ler o mesmo dado.
- **Fase 2: Barbeiro no celular, atalhos e tempo real.**
  - "Seu próximo", Iniciar, Finalizar e Pausa.
  - Atalhos N, C, 1–9 e F no PC.
  - SSE.
- **Fase 3: Check-in por QR na porta** e duração real média por barbeiro e serviço (aprendida do histórico).
- **Fase 4: Fechamento com Pix na tela** (`charge.paid`), comprovante por WhatsApp, sinal abatido e comissão no caixa.
  - Depende de `docs/pagamentos/checkout-sem-maquininha.md`, que a especificação cita mas **não está no repositório**.
- **Fase 5: Promoção de horário vazio:** detecção, sugestão com aprovação, oferta, público com opt-in (LGPD), envio por WhatsApp (módulo adicional) e métricas.
- **Fase 6: Resiliência offline:** ações em fila local, sincronização e indicador "offline".
- **Depois da fase 1:** a parte 3 do 0019 (fidelidade e pacotes no banco), ligada ao pagamento do atendimento.

## Esclarecimentos

- O `checkout-sem-maquininha.md` não está no projeto. Como fecho? → **"Fase 1 com formas manuais"**. O Pix na tela entra na fase 4, quando o arquivo existir.
- Ordem das fases? → **"Só a fase 1 agora"**: implementar o núcleo e parar para o usuário testar antes de decidir o resto.

## Como ficou a fase 1

- **Banco:**
  - `agendamentos` virou `atendimentos`, com o ciclo de vida da especificação; os dados existentes foram convertidos.
  - Novas tabelas `bloqueios`, `caixas` e `comandas` (itens congelados em JSON), mais `barbeiros.em_pausa`.
- **Domínio** (`libs/dominio/src/balcao.js`): `podeTransitar`, `ordenarFila`, `situacaoDosBarbeiros` e `sugerirEncaixe`, este último simulando a fila que já espera antes do avulso novo.
- **API:**
  - `GET /api/balcao` (painel) e `GET /api/balcao/encaixe`;
  - `POST /api/balcao/avulsos`;
  - `POST /api/atendimentos/:id/{checkin,iniciar,finalizar,desistir,no-show}`;
  - `POST /api/barbeiros/:id/pausa`;
  - caixa e comandas em `/api/caixa` e `/api/comandas`;
  - resumo e comandas do cliente pelo banco.
- **Front:** tela **Balcão** (`/balcao`, primeiro item do menu) e o diálogo **Avulso**. O caixa, as comandas e o cadastro do cliente passam a usar a API. O `DsEscolha` ganhou opções com detalhe e desabilitadas.
- **Semente de simulação:** `pnpm nx run api:semear` cria, na Studio Negoboy:
  - catálogo, equipe (o barbeiro NegoBoy ligado à conta do dono) e clientes;
  - 3 semanas de histórico pago;
  - agenda de hoje e de amanhã;
  - caixa de hoje aberto.

  Só roda se a barbearia ainda não tiver serviços.

### Decisões tomadas na execução

- **Ordem da fila:**
  1. agendado no horário;
  2. agendado atrasado: perde o horário reservado, mas fica à frente dos avulsos, lendo "vira prioridade no próximo encaixe";
  3. avulsos por chegada.
- **A agenda atual não foi reescrita.** A API traduz o status para o vocabulário que ela usa (`estadoNaAgenda`) e os bloqueios vêm com **id negativo**. A unificação visual fica para a fase 2.
- **Avulso sem telefone** fica como "Cliente balcão", sem cadastro. **Com telefone**, reaproveita o cliente pelo número ou cria um cadastro para completar depois.
- **Iniciar um avulso** é recusado (409) se atropelar um agendado do barbeiro, considerando a folga.
- **Permissões:** o balcão usa `agenda.gerenciar` ou `caixa.operar`. As permissões do próprio barbeiro ficam para a fase 2.
- **Atualização:** o painel recarrega a cada 15 s. SSE fica para a fase 2.
- **Pacotes e fidelidade** no caixa pela API: recusados com mensagem até a parte 3 do 0019.

## Critérios de pronto (fase 1)

- Registrar um avulso em até 3 toques e em menos de 10 s.
- O avulso nunca ocupa a janela de um agendado. A fila segue a prioridade definida.
- Do check-in (ou da fila) ao pago, a comanda acompanha o atendimento. O caixa do dia mostra avulsos e agendados.
- Tudo isolado por barbearia (RLS). `pnpm verificar:tudo` passa.

## Registro de mudanças

- 2026-11-07: rascunho criado a partir do pedido de operação pelo barbeiro.
- 2026-11-07: reescrito a partir da especificação `docs/atendimento/balcao.md`. A parte 2 do 0019 (caixa e comandas) foi absorvida pela fase 1.
- 2026-11-07: aprovado pelo usuário (só a fase 1; fechamento com formas manuais).
- 2026-11-07: fase 1 implementada (ver _Como ficou a fase 1_). O usuário pediu dados para simular a Studio Negoboy ("implemente dados para a barbearia negoboy, serviços clientes, equipe, produtos e etc para eu poder simular").
