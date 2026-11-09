# Balcão — atendimento rápido (avulso + agendado)

O BarberTime tem uma experiência de **PDV de atendimento rápido** para o cliente avulso (que chegou sem agendamento) e, ao mesmo tempo, é totalmente preparado para o agendamento. Os dois entram por portas diferentes e seguem o **mesmo caminho**.

## Decisões

- **Entidade única: `atendimento`.** Agenda e fila são visões do mesmo dado. Não existem duas listas.
- **A comanda nasce no check-in ou na entrada na fila**, não no fim. Produtos podem ser lançados durante o serviço.
- **O avulso nunca rouba o horário de quem agendou.**
- **Fila só presencial.** O cliente não entra na fila pelo WhatsApp nem remotamente: a fila é formada por quem está na barbearia.
- **Promoção de horário vazio** faz parte do produto.
- O fechamento usa o checkout sem maquininha (ver [checkout-sem-maquininha.md](../pagamentos/checkout-sem-maquininha.md)).

## Ciclo de vida do atendimento

```
Agendado:  agendado ──► chegou (check-in) ─┐
                                           ├─► em_atendimento ──► finalizado ──► pago
Avulso:    na_fila ────────────────────────┘
              └─► desistiu            agendado ──► no_show
                                      agendado ──► cancelado
```

| Status                               | Quando                                          |
| ------------------------------------ | ----------------------------------------------- |
| `agendado`                           | horário marcado (online ou pela recepção)       |
| `chegou`                             | check-in feito no balcão ou pelo QR na porta    |
| `na_fila`                            | avulso registrado no balcão                     |
| `em_atendimento`                     | barbeiro iniciou                                |
| `finalizado`                         | serviço concluído e comanda pronta para cobrar  |
| `pago`                               | `charge.paid` recebido (ou dinheiro registrado) |
| `desistiu` / `no_show` / `cancelado` | saídas sem atendimento                          |

Campos principais: `tenant_id`, `origem` (`agendamento` | `avulso`), `cliente_id` (opcional), `barbeiro_id` (ou null = primeiro livre), `servicos[]`, `duracao_prevista`, `horario_agendado`, `chegou_em`, `iniciado_em`, `finalizado_em`, `comanda_id`, `status`.

## Tela "Balcão"

Tela única, pensada para tablet no balcão (funciona em PC com atalhos de teclado), em modo tela cheia.

| Agora                                                   | Fila / chegadas                                                 | Próximos                                                |
| ------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| Cada barbeiro: livre · ocupado (tempo restante) · pausa | Avulsos esperando e agendados que chegaram, com tempo de espera | Agendamentos das próximas 2–3 h, com botão **Check-in** |

Botão **"+ Avulso"** sempre visível.

### Avulso em até 3 toques

1. **Serviço:** botões grandes com os mais vendidos (corte, barba, combo).
2. **Barbeiro:** "Primeiro livre" (padrão) ou um específico.
3. **Cliente (opcional):** só o WhatsApp, ou pular ("Cliente balcão").

Sem formulário. O telefone é incentivado (fidelidade, cashback, lembretes futuros), mas nunca obrigatório.

### Atalhos (PC)

| Tecla   | Ação                                         |
| ------- | -------------------------------------------- |
| `N`     | novo avulso                                  |
| `C`     | check-in do próximo agendado                 |
| `1`–`9` | escolher serviço/barbeiro na sequência       |
| `F`     | finalizar e cobrar o atendimento selecionado |

## Encaixe sem atropelar a agenda

Ao registrar um avulso, o sistema calcula para cada barbeiro:

```
janela = início do próximo agendamento − (agora ou fim do atendimento atual)
pode_atender_agora = barbeiro livre E janela ≥ duracao_prevista + folga
```

- Alguém pode atender agora → sugere esse barbeiro ("Primeiro livre" resolve sozinho).
- Ninguém pode → mostra a **previsão de espera** por barbeiro ("~25 min com o João"). O cliente decide entre esperar na fila ou agendar um horário.
- A previsão usa a duração real média de cada barbeiro por serviço (aprendida do histórico), não só a duração cadastrada.
- `folga` é configurável por barbearia (padrão 5 min).

### Prioridade da fila

1. Agendado que chegou, dentro da tolerância.
2. Avulsos por ordem de chegada.
3. Agendado atrasado além da tolerância perde a vez e vira prioridade no próximo encaixe possível.

## Check-in

- **No balcão:** botão Check-in na coluna "Próximos".
- **QR na porta:** o cliente agendado lê o QR e confirma que chegou. Isso **não** coloca ninguém na fila remotamente: o QR só é exibido na barbearia.
- **Tolerância de atraso** configurável (padrão 10 min).

## Promoção de horário vazio

O sistema identifica janelas ociosas na agenda e sugere uma oferta.

- **Detecção:** janelas livres ≥ duração do serviço nas próximas X horas (padrão 3 h) ou no dia seguinte.
- **Sugestão no balcão:** "João tem 40 min livres às 15h. Disparar promoção?" A barbearia aprova com um toque. Nada é enviado automaticamente sem aprovação, a menos que ela ative o modo automático.
- **Oferta:** desconto (% ou valor) ou brinde, com validade só para aquele horário.
- **Público:** clientes que costumam frequentar naquele dia/horário, que estão "atrasados" no ciclo habitual de corte, ou que optaram por receber ofertas. Respeitar opt-in/opt-out (LGPD).
- **Canal:** WhatsApp com link de agendamento já filtrado para o horário. Quem clica **agenda** o horário (vira `agendado`), não entra em fila.
- **Regras:** limite de envios por cliente por semana e cancelamento automático da oferta quando o horário é preenchido.
- **Métricas:** taxa de ocupação recuperada, conversão por oferta e receita vinda de promoções.

## Visão do barbeiro (celular)

- "Seu próximo: Carlos · combo · 14h20".
- Botões **Iniciar** e **Finalizar** (finalizar envia a comanda para cobrança no balcão ou abre o Pix na hora).
- Botão **Pausa** (some da sugestão de encaixe).

## Fechamento

Ao finalizar, abre o checkout: Pix na tela → `charge.paid` → comanda fecha → comprovante por WhatsApp. Sinal pago no agendamento é abatido. O caixa do dia mostra avulsos e agendados juntos, com comissão calculada.

## Requisitos não funcionais

- **Resiliência à internet instável:** fila e comanda aguentam quedas curtas. Ações ficam em fila local e sincronizam ao voltar, com indicador visível de "offline".
- **Tempo real:** a tela do balcão e a do barbeiro atualizam sozinhas (SSE/WebSocket).
- **Velocidade:** registrar um avulso em menos de 10 segundos.
- **Multi-tenant:** toda consulta filtrada por `tenant_id`.

## Configurações por barbearia

| Configuração                             | Padrão                     |
| ---------------------------------------- | -------------------------- |
| Folga entre atendimentos                 | 5 min                      |
| Tolerância de atraso                     | 10 min                     |
| Exigir telefone no avulso                | não                        |
| Check-in por QR na porta                 | sim                        |
| Promoção de horário vazio                | sugerir (aprovação manual) |
| Antecedência para detectar horário vazio | 3 h                        |
| Máximo de ofertas por cliente/semana     | 1                          |

## Métricas

- Tempo médio de espera do avulso.
- % de avulsos que desistem.
- Ocupação por barbeiro (agendado vs. avulso vs. ocioso).
- Atraso médio dos agendados em relação ao horário marcado.
- Horários vazios recuperados por promoção.

## Fora de escopo

- Entrar na fila pelo WhatsApp ou remotamente.
- Maquininha de cartão.
