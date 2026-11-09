# BarberTime: definição e escopo

- **Versão:** 1.0
- **Data:** 2026-11-07
- **Responsável:** Weslen
- **Relacionado:** [README](../README.md), [planejamento 0001](planejamentos/0001-escopo-e-roadmap.md), [ADR 0001](adr/0001-saas-multi-tenant.md), [ADR 0002](adr/0002-docker-no-desenvolvimento.md), [ADR 0003](adr/0003-identidade-visual-e-tokens.md), [identidade visual](identidade-visual/README.md)

## 1. Definição

O **BarberTime** é um **SaaS multi-tenant de agendamento e gestão para barbearias**, feito para o mercado brasileiro. Reúne num só lugar a agenda por barbeiro, o atendimento pelo WhatsApp, a fila de quem chega sem hora marcada, o caixa com comissões e as assinaturas que a barbearia vende aos seus clientes.

**Em uma frase:** a barbearia para de agendar "na mão" no WhatsApp, reduz faltas e passa a ter receita recorrente com planos, sem juntar três sistemas diferentes.

## 2. Problema

Hoje a barbearia típica:

1. agenda pelo WhatsApp manualmente, e o dono perde horas por dia respondendo mensagens;
2. sofre com faltas por não ter lembrete e confirmação;
3. cobra assinaturas e clubes numa plataforma separada (ex.: Asaas), sem ligação com a agenda;
4. não sabe ao certo quanto faturou, quanto deve de comissão e quais serviços dão resultado;
5. atende quem chega sem hora marcada sem nenhuma organização de fila.

## 3. Público

| Perfil             | Quem é                                        | O que espera do BarberTime                                                    |
| ------------------ | --------------------------------------------- | ----------------------------------------------------------------------------- |
| **Dono / gerente** | Quem contrata e paga o SaaS                   | Agenda cheia, menos faltas, controle de caixa e comissões, receita recorrente |
| **Recepção**       | Quem opera o balcão (às vezes o próprio dono) | Agendar, encaixar e cobrar rápido, sem trocar de tela                         |
| **Barbeiro**       | Profissional que atende                       | Ver a própria agenda e as próprias comissões                                  |
| **Cliente final**  | Quem corta o cabelo; não paga o SaaS          | Agendar em segundos pelo link ou WhatsApp, sem instalar app                   |
| **Super admin**    | Equipe do BarberTime                          | Gerenciar barbearias, planos, cobrança e suporte                              |

**Perfil-alvo inicial:** barbearias de 1 a 10 profissionais, com ou sem plano de assinatura, que hoje agendam pelo WhatsApp.

## 4. Proposta de valor

- **Para a barbearia:** o básico de qualquer concorrente, com os pontos em que o mercado é fraco: WhatsApp como canal principal, assinaturas integradas à agenda, fila para quem chega sem hora marcada e emissão de NFS-e.
- **Para o cliente final:** agendar, remarcar e confirmar pelo WhatsApp ou por um link, sem cadastro longo nem app.
- **Modelo comercial:** mensalidade por plano e por profissional, **sem comissão sobre agendamentos** (diferente de marketplaces como Booksy e Fresha).

## 5. Escopo do MVP (fase 1)

O que todo concorrente oferece e o BarberTime precisa ter para ser vendável.

| #   | Funcionalidade            | Inclui                                                                                                    | Critério de pronto                                                                            |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Agenda por barbeiro       | Serviços com duração própria, horário de trabalho por profissional, intervalos, bloqueios (almoço, folga) | Recepção vê o dia em colunas por barbeiro e não consegue marcar dois atendimentos sobrepostos |
| 2   | Agendamento online        | Página pública `barbertime.com.br/<slug>` com serviço, barbeiro, dia e horário                            | Cliente agenda pelo celular em até 4 toques; só aparecem horários realmente livres            |
| 3   | Lembrete e confirmação    | Mensagem antes do horário com confirmar, remarcar ou cancelar (e-mail/link no MVP; WhatsApp na fase 2)    | Agendamento muda de "pendente" para "confirmado" pela resposta do cliente                     |
| 4   | Cadastro de clientes      | Contato, histórico de atendimentos, observações                                                           | Ao abrir um agendamento, a recepção vê o histórico e as observações do cliente                |
| 5   | Caixa e comanda           | Serviços e produtos na comanda, desconto, forma de pagamento, abertura e fechamento de caixa              | Fechamento do dia bate com a soma das comandas por forma de pagamento                         |
| 6   | Comissão por profissional | Percentual ou valor fixo por serviço/produto, fechamento por período                                      | Relatório de comissão do período por barbeiro, conferível item a item                         |
| 7   | Relatórios                | Faturamento por período e por barbeiro, serviços e produtos mais vendidos                                 | Dono vê o resultado do mês sem planilha                                                       |

**Plataforma, também no MVP:** cadastro self-service da barbearia com período de teste, usuários e papéis por barbearia, isolamento de dados por barbearia (ADR 0001), cobrança do próprio SaaS com planos e limites, painel do super admin.

## 6. Diferenciais (fases 2 a 4)

| Fase | Diferencial                                                                                     | Por quê                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 2    | **WhatsApp primeiro**: agendamento, lembretes e avisos pelo WhatsApp                            | 80% a 90% dos clientes topam agendar pelo WhatsApp, contra 15% a 25% por app                                       |
| 2    | **Assinatura ou clube** integrado à agenda: controle de uso, cobrança recorrente, inadimplência | Tendência no Brasil; barbearias com 200 assinantes e cerca de 25% do faturamento em planos de R$ 99,90 a R$ 189,90 |
| 3    | **Fila para quem chega sem hora**: check-in, estimativa de espera, encaixe entre agendamentos   | Comum em barbearia e quase ausente nos concorrentes                                                                |
| 3    | **Lista de espera automática**                                                                  | Cancelou, avisa quem está esperando                                                                                |
| 3    | **Promoção de horário vazio**                                                                   | Ocupa manhãs e dias fracos                                                                                         |
| 4    | **Fidelidade ou cashback** e campanhas de retorno                                               | Traz de volta o cliente sumido há X dias                                                                           |
| 4    | **Nota fiscal (NFS-e)** a partir da comanda                                                     | Poucos concorrentes emitem                                                                                         |

## 7. Fora do escopo

Por ora, o BarberTime **não** terá:

- marketplace para clientes descobrirem barbearias (o foco é a barbearia trazer o próprio cliente);
- app nativo nas lojas no MVP (a página pública e o painel são web/PWA; empacotamento mobile depois);
- estoque completo com compras e fornecedores (no MVP, só a venda de produto na comanda);
- folha de pagamento, contabilidade ou integração com ERP;
- emissão de NF-e de produto (só NFS-e, na fase 4);
- pagamento online no agendamento (sinal ou pré-pago), que fica para depois da fase 2;
- personalização visual por barbearia além de logo e nome (ADR futuro, ligado aos planos).

## 8. Planos do SaaS (rascunho)

| Plano  | Para quem                     | Inclui                                                                        |
| ------ | ----------------------------- | ----------------------------------------------------------------------------- |
| Solo   | Barbeiro autônomo             | Agenda, link de agendamento, lembretes, clientes, caixa                       |
| Equipe | Barbearia com até N barbeiros | Solo + comissões, relatórios, WhatsApp, fila e lista de espera                |
| Pro    | Barbearia que vende planos    | Equipe + assinaturas de clientes, fidelidade/cashback, NFS-e, domínio próprio |
| Rede   | Várias unidades               | Pro + multiunidade e relatórios consolidados                                  |

Preço por profissional; valores a definir após validação com barbearias.

## 9. Requisitos não funcionais

- **Multi-tenant seguro:** PostgreSQL compartilhado com `barbearia_id` e Row-Level Security; testes que tentam ler dados de outra barbearia e precisam falhar (ADR 0001).
- **Celular primeiro:** página pública e telas de balcão usáveis com uma mão, alvos de toque de 44px.
- **Desempenho:** página pública carrega em menos de 2 s em 4G; agenda do dia abre em menos de 1 s.
- **Disponibilidade:** meta de 99,5% no MVP; lembretes e cobranças em fila (Redis), com nova tentativa.
- **LGPD:** consentimento para mensagens, exportação e exclusão dos dados do cliente final, registro de acesso, fontes e recursos servidos pelo próprio app.
- **Acessibilidade:** contraste de 4,5:1 nos dois temas, estado nunca só por cor (ADR 0003).
- **Idioma e formatos:** pt-BR, horário 24 h, `R$ 1.284,00`, fuso horário por unidade.
- **Ambiente:** desenvolvimento em WSL 2 com Docker Compose (ADR 0002).

## 10. Stack e decisões

| Tema                                                          | Decisão                                                  | Onde                |
| ------------------------------------------------------------- | -------------------------------------------------------- | ------------------- |
| Arquitetura SaaS                                              | Multi-tenant, banco compartilhado, RLS                   | ADR 0001            |
| Ambiente de desenvolvimento                                   | WSL 2 + Docker Compose (PostgreSQL, Redis, Mailpit)      | ADR 0002            |
| Preferências do usuário                                       | Sessão + banco, catálogo fechado                         | ADR 0006            |
| Identidade visual                                             | Industrial-urbana, tokens como fonte única               | ADR 0003            |
| Monorepo, front e API                                         | Nx, Vue 3 em JavaScript com design system `Ds*`, Fastify | ADR 0007 e ADR 0008 |
| ORM, autenticação, hospedagem, WhatsApp, gateway de pagamento | A decidir                                                | ADRs da fase 0 e 2  |

## 11. Premissas

- Barbearias aceitam pagar mensalidade fixa se o sistema reduzir faltas e o tempo no WhatsApp.
- O cliente final prefere agendar pelo WhatsApp ou por link a instalar um app.
- A API oficial do WhatsApp (ou um provedor) tem custo por mensagem que cabe no preço do plano.
- Um gateway brasileiro (ex.: Asaas) atende tanto a cobrança do SaaS quanto as assinaturas das barbearias, com subcontas.

## 12. Riscos

| Risco                                                 | Impacto                     | Mitigação                                                                      |
| ----------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| Custo e regras do WhatsApp                            | Margem e bloqueio de número | Modelos de mensagem aprovados, custo medido por barbearia e repassado no plano |
| Vazamento de dados entre barbearias                   | Grave (confiança e LGPD)    | RLS no banco, contexto de tenant na API, testes de isolamento                  |
| Concorrência estabelecida (Trinks, AppBarber, Booksy) | Dificuldade de venda        | Foco em WhatsApp, assinaturas e fila; preço por profissional sem comissão      |
| Escopo crescer antes do MVP                           | Atraso                      | Fases fechadas; tudo fora do MVP vira planejamento próprio                     |
| Emissão de NFS-e varia por município                  | Complexidade alta           | Emissor terceirizado com cobertura nacional; só na fase 4                      |

## 13. Métricas de sucesso

- **Faltas:** queda de pelo menos 40% nas barbearias que usam lembrete com confirmação.
- **Agendamento online:** pelo menos 50% dos agendamentos feitos pelo próprio cliente (link ou WhatsApp) após 60 dias de uso.
- **Ativação:** barbearia configurada (serviços, equipe, horários) e com o primeiro agendamento online em até 1 dia após o cadastro.
- **Retenção:** cancelamento mensal do SaaS abaixo de 5%.
- **Assinaturas (fase 2):** barbearias do plano Pro com pelo menos 20 assinantes ativos em 90 dias.

## 14. Glossário

Barbearia (tenant), unidade, profissional, serviço, agendamento, encaixe, fila, comanda, comissão, plano do SaaS e plano do cliente estão definidos no [README](../README.md#conceitos-do-domínio).
