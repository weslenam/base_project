# Planejamento 0001: Escopo do produto e roadmap do BarberTime

- **Status:** Aprovado
- **Data:** 2026-11-07
- **Solicitado por:** Weslen
- **Relacionado:** README.md, ADRs 0001, 0002, 0003, 0006, 0007 e 0008, planejamentos 0002, 0003 e 0004
- **Commits:** ainda não commitado

## Solicitação de origem

> agora quero fazer o seguinte procure das aplicações existente o que elas oferecem

> ok, vamos estruturar então um readme para o barbertime usando:
>
> O básico que todos oferecem (MVP)
>
> 1. Agenda por barbeiro, com serviços de duração diferente e bloqueio de horários
> 2. Agendamento online pelo cliente, por link, app ou WhatsApp
> 3. Lembrete e confirmação automáticos
> 4. Cadastro de clientes com histórico e observações
> 5. Caixa e comanda: serviços, produtos e forma de pagamento
> 6. Comissão por profissional
> 7. Relatórios de faturamento e dos serviços mais vendidos
>
> Onde estão os diferenciais
>
> - Assinatura ou clube: é a grande tendência no Brasil. [...]
> - WhatsApp primeiro: [...]
> - Fila para quem chega sem hora marcada: [...]
> - Lista de espera automática: [...]
> - Promoção de horário vazio, como desconto nas manhãs de segunda.
> - Fidelidade ou cashback, além de pedir retorno ao cliente sumido há X dias.
> - Nota fiscal (NFS-e), que poucos têm. [...]
>
> a partir dai vamos usar a base para trabalhar com o desenvolvimento

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente (Cowork)
- Os trechos `[...]` repetem o texto da pesquisa de concorrentes, transcrito por completo no README.

### Solicitações relacionadas

> temos que pensar q ele será um Saas (2026-11-07)

> tá certo e vamos trabalhar com docker para desenvolvimento (2026-11-07)

> peço desculpas temos q trabalhar com o wsl2 (2026-11-07)

> precisamos trabalhar numa identidade visual, consegue analisar e criar uma? (2026-11-07)

> precisamos que essa identidade visual sejja consumida no barbertime como base para implementação possivelmente como ADRs (faz sentido?) (2026-11-07)

> crie um arquivo md da definicao e escopo do barbertime (2026-11-07)

## Objetivo

Definir o escopo do BarberTime a partir da pesquisa de concorrentes (AppBarber, Trinks, BestBarbers, Belasis, Space Barber, Booksy, Fresha, Zenoti e agentes de WhatsApp): MVP com os 7 itens básicos e diferenciais organizados em fases. **Fora do escopo:** implementação de código; ela começa nos planejamentos da fase 0.

## Decisões e restrições

- O repositório parte do `base_project` (skills e configs de agentes) e segue as skills `planejamento-documentado` e `design-system`.
- Front em JavaScript (sem TypeScript), Vue 3 e design system `Ds*`.
- O produto é um **SaaS multi-tenant**: isolamento por barbearia, onboarding self-service, página pública por slug, cobrança do próprio SaaS com planos e limites, papéis por barbearia e LGPD.
- Proposta de multi-tenancy em PostgreSQL com `barbearia_id` e RLS (ADR 0001, aceito); stack completa em ADR na fase 0.
- API em **Fastify** (ADR 0008), decidido em 2026-11-07 no lugar do NestJS citado na primeira versão.

## Etapas

- [x] Pesquisar o que os sistemas existentes oferecem
- [x] Escrever o README com problema, MVP, diferenciais, roadmap e conceitos do domínio
- [x] Incluir o modelo SaaS no README (perfis, requisitos de plataforma, planos) e propor o ADR 0001
- [x] Aprovar o ADR 0001 e registrar Docker no desenvolvimento (ADR 0002, docker-compose com PostgreSQL, Redis e Mailpit)
- [x] Desenvolvimento dentro do WSL 2 (ADR 0002 revisado, README com preparo da máquina)
- [x] Documento de definição e escopo em `docs/definicao-e-escopo.md`
- [x] Identidade visual industrial-urbana (logo, paleta, tipografia, telas de exemplo) em `docs/identidade-visual/` e ADR 0003
- [x] Mover o repositório para o WSL 2 (`~/projetos/barbertime`)
- [ ] Fase 0: ADR de stack (ORM, autenticação, hospedagem); workspace Nx com api e web no docker-compose, `libs/ui-tokens` gerado do `tokens.json` e fontes self-hosted, usuários e papéis, onboarding, página pública e painel do super admin
  - [x] Workspace Nx, api Fastify e web Vue (planejamento 0002)
  - [x] Kit base `Ds*` com Vuetify e contratos (planejamento 0003)
  - [x] `libs/ui-tokens` gerado do `tokens.json`, fontes self-hosted, logos e docker-compose com api e web (planejamento 0004)
  - [ ] ADR de ORM, migrações, autenticação e hospedagem
  - [ ] Usuários e papéis, onboarding, página pública e painel do super admin
- [ ] Fase 1: MVP (itens 1 a 7) e cobrança do SaaS com limites por plano
- [ ] Fase 2: WhatsApp e assinaturas
- [ ] Fase 3: fila, lista de espera e promoção de horário vazio
- [ ] Fase 4: fidelidade/cashback, campanhas de retorno e NFS-e

## Registro de mudanças

- 2026-11-07: Plano criado em outra sessão (Cowork) e trazido para o repositório no WSL 2.
- 2026-11-07: Fase 0 parcialmente concluída nos planejamentos 0002–0004; API definida como Fastify (ADR 0008).
