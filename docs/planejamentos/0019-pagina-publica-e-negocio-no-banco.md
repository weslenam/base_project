# Planejamento 0019: Página pública publicável e operação da barbearia no banco

- **Status:** Em andamento
- **Data:** 2026-11-07
- **Solicitado por:** weslenam
- **Relacionado:** ADRs 0001, 0009, 0010, 0011, 0012 e 0013; planejamento 0013 (fase 3)
- **Commits:** parte 1 (ver git log: "feat: página pública publicável e agenda no banco")

## Solicitação de origem

> temos que encontrar um modo para a pagina publica, quando publicarmos o sistema deve permitir essa ação talvez por algum link compartilhado com token não tenho uma estrategia

Feita com uma captura de `/agendar/studio-negoboy` mostrando "Não encontramos essa barbearia". A barbearia foi cadastrada pela API, mas a página pública ainda lê os dados de exemplo.

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Como a página pública deve ser acessada? → **"Dono escolhe"**:
    - Pública: `/agendar/slug`, para divulgar no Instagram e no Google.
    - Só com link: `/agendar/slug?c=TOKEN`, com token que pode ser trocado para invalidar o link antigo.
    - Desativada.
    - Mais um painel "Compartilhar" com o link, copiar, texto para WhatsApp e QR code.
  - Migrar serviços, equipe e agenda para o banco agora? → **"Sim, migrar agora"**, em partes com commits.

## Objetivo

Qualquer barbearia cadastrada consegue publicar a página de agendamento e operar de verdade: as telas internas e a página pública passam a usar a API e o banco, com RLS.

**Partes:**

1. Página pública, serviços, produtos, equipe, clientes e agenda.
2. Caixa e comandas, mais o resumo e as comandas do cliente.
3. Fidelidade, pacotes e assinaturas.

**Fora do escopo:** limite de requisições na API pública (pendência registrada), verificação do telefone por código e domínio próprio da barbearia.

## Decisões e restrições

- **Visibilidade da página** (ADR 0013):
  - Fica em `barbearias.configuracoes.paginaPublica.modo` (`publica` | `com_link` | `desativada`).
  - O token fica em `barbearias.token_publico`. Trocar o token invalida o link antigo.
  - A página também exige o módulo `agendamento_online` ativo (ADR 0011).
  - Página inexistente, desativada ou com token errado recebem **a mesma resposta 404**, para não revelar que a barbearia existe.
- **API pública** em `/api/publico/:slug`, sem sessão:
  - Devolve só o necessário: nome, contato, serviços, barbeiros e horários livres.
  - O reconhecimento por telefone devolve só o primeiro nome (LGPD).
  - Aplica as regras do agendamento online (antecedência mínima, dias à frente) e o horário de funcionamento.
- **Duas implementações da camada de dados do front**, com a mesma interface (`api.*`):
  - **HTTP** em `pnpm dev` e produção.
  - **Memória** (dados de exemplo) nos testes do front e com `VITE_DADOS=exemplo`.
  - As regras valem no servidor; os testes de integração cobrem a API.
- **Exclusão sem perder histórico:**
  - Serviços, produtos e barbeiros são excluídos de forma lógica (`excluido_em`), para manter agendamentos e comandas antigas.
  - Clientes são excluídos de fato: os agendamentos vão junto e as comandas viram avulsas.
- **Conflito de horário:** a gravação trava a linha do barbeiro (`for update`) na transação antes de conferir sobreposição.
- **Fuso:** "hoje" e "agora" são calculados no fuso da barbearia (padrão `America/Sao_Paulo`), não no do servidor.
- **Valores** em reais com 2 casas (`numeric(10,2)`), lidos como Number.

## Etapas

- [x] 1. Migração das tabelas do negócio (parte 1) com RLS; token público.
- [x] 2. API: serviços, produtos, barbeiros, clientes, agendamentos; página pública; configuração da página e troca de token. Integração.
- [x] 3. Front: `apiHttp.js` e escolha da implementação; página pública via `api.publico`; aba "Página pública" em Configurações com compartilhar (link, copiar, WhatsApp, QR).
- [x] 4. Semente com serviços, equipe e clientes da barbearia modelo.
- [ ] 5. Parte 2: caixa e comandas.
- [ ] 6. Parte 3: fidelidade, pacotes e assinaturas.
- [ ] 7. ADR 0013, README, `pnpm verificar:tudo`, commits por parte.

## Critérios de pronto

- `/agendar/<slug>` de uma barbearia nova (ex.: Studio Negoboy) abre e agenda quando o modo é "Pública". No modo "Só com link", só abre com o token. Desativada, mostra "não encontrada".
- Agenda, clientes, equipe, serviços e produtos de uma barbearia nova começam vazios e guardam o que for cadastrado.
- `pnpm verificar:tudo` passa.

## Riscos e pendências

- **API pública sem limite de requisições:** é preciso um rate limit (por IP e por slug) antes de produção.
- **Até a parte 3:** em `pnpm dev`, fidelidade e pacotes ainda vêm da memória.

## Registro de mudanças

- 2026-11-07: plano criado com as respostas do usuário.
- 2026-11-07: parte 1 concluída. Decidido junto: o item "Página pública" saiu do menu, porque no modo "só com o link" a sessão não conhece o código. O link fica em Configurações > Página pública. O pedido de operação pelo próprio barbeiro, com encaixe e fila, virou o planejamento 0020.
