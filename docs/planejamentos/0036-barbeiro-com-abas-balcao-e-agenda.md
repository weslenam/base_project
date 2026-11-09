# Planejamento 0036: Barbeiro com abas Balcão e Agenda

- **Status:** Concluído
- **Data:** 2026-11-09
- **Solicitado por:** Weslen
- **Relacionado:** planejamentos 0020 (balcão e operação pelo barbeiro), 0035 (Barbeiro sem menu); ADRs 0010, 0014 e 0020
- **Commits:** ainda não commitado

## Solicitação de origem

> pode commitar e precisamos rever a questão da visão do barbeiro ele pode ver a tela balcao e a agenda mas queria tentar nao usar o menu lateral será q podemos fazer duas tabs ? mudaria muito nosso layout?

- **Quando:** 2026-11-09 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Onde ficam as abas? → **Topo no PC, rodapé no celular.**
  - O que o Barbeiro faz no Balcão? → **Ver fila e situação; iniciar/finalizar os dele; check-in e avulso; desistência e falta.**
  - Caixa? → **Recebe também** (ganha `caixa.operar`).
  - Tela inicial? → **Balcão.**
  - Mini-spec → "sim esta aprovado".

## Objetivo

O Barbeiro alterna entre Balcão e Agenda por abas, sem menu lateral. No Balcão ajuda no atendimento (check-in, avulso, receber), mas só inicia e finaliza os próprios atendimentos.

**Fora do escopo:** tela Caixa (fechar, lista de comandas) para o Barbeiro, SSE e atalhos de teclado (fase 2 do 0020).

## Decisões e restrições

- `DsLayout` ganha a prop `abas` (`[{ titulo, rota, icone }]`): abaixo do cabeçalho no PC/tablet, barra fixa no rodapé no celular; com `abas`, sem menu lateral. Cada aba é um link de rota.
- Barbeiro entra por `/balcao`; rotas dele: `/balcao`, `/agenda`, `/perfil`.
- Papel Barbeiro ganha `caixa.operar` (sem `caixa.fechar`). Vale para todas as barbearias (papéis fixos, ADR 0010).
- Regra `podeAgirNoBalcao` no domínio, para quem não tem `agenda.gerenciar`:

| Ação no Balcão | Barbeiro |
|---|---|
| Ver painel, fila e próximos | sim |
| Check-in e avulso | qualquer cliente |
| Iniciar | só com ele mesmo como barbeiro |
| Finalizar | só os dele |
| Desistência e falta | coluna dele ou os que criou |
| Receber a comanda | sim |
| Pausa | só a própria |

## Etapas

- [x] 1. Domínio: `caixa.operar` no Barbeiro, `podeAgirNoBalcao`, rotas sem menu com Balcão; testes.
- [x] 2. API do Balcão: conferência por item e `criado_por` no avulso; testes de integração.
- [x] 3. `DsLayout` com `abas` (contrato + Vuetify).
- [x] 4. App, guarda de rotas e ações do Balcão pela regra.
- [x] 5. Verificar: `pnpm verificar`, `api:integracao`, `verificar:layout` e capturas.

## Critérios de pronto

- Barbeiro entra no Balcão e alterna para a Agenda pelas abas (topo no PC, rodapé no celular), sem sanduíche.
- No Balcão não inicia nem finaliza atendimento de outro barbeiro (403 e sem botão); faz check-in, avulso e recebe.
- Outros papéis sem mudança.

## Riscos e pendências

- Em barbearia com recepção, os barbeiros também passam a receber pagamento.
- Item da fila sugerido a outro barbeiro: o Barbeiro não vê "Iniciar" (não há "atender eu" para puxar o cliente para si).
- No celular, a página do Balcão ainda tem o botão "Agenda" no topo, redundante com as abas.

## Registro de mudanças

- 2026-11-09 — Plano criado e aprovado pelo Weslen.
- 2026-11-09 — Implementado. Acréscimo: pausa só a própria (mesma lógica de iniciar). O painel do Balcão expõe `usuarioId` de cada barbeiro para a tela esconder as ações. Login sem "volta" vai para `/`, que leva o Barbeiro ao Balcão (o guarda evita laço de redirecionamento, pego no `verificar:layout`). Verificado: `pnpm verificar`, `api:integracao` (116, inclui `balcaoBarbeiro.spec.js`) e `verificar:layout` (81).
