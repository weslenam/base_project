# Planejamento 0039: Barbeiro sem abrir o caixa

- **Status:** Concluído
- **Data:** 2026-11-09
- **Solicitado por:** Weslen
- **Relacionado:** planejamentos 0036 (Barbeiro no Balcão) e 0023 (papéis fixos); ADR 0010
- **Commits:** ainda não commitado

## Solicitação de origem

> podemos criar um ACL para que o barbeiro não abra o caixa mas mantenha o acesso ao balcão

- **Quando:** 2026-11-09 · **Origem:** Conversa com o assistente
- **Esclarecimentos:** nenhum. O Barbeiro continua recebendo, conforme a decisão "Recebe também" do planejamento 0036.

## Objetivo

Abrir o caixa do dia passa a exigir a permissão nova `caixa.abrir`. O Barbeiro não a recebe, mas mantém `caixa.operar` e continua no Balcão. Com o caixa aberto, ele lança avulso, faz check-in e recebe.

## Decisões

- Recebem `caixa.abrir`: Dono, Gerente e Recepção. O Barbeiro não recebe.
- `POST /api/caixa/abrir` exige `caixa.abrir` e responde 403 para quem não a tem.
- Com o caixa fechado, quem não pode abrir vê um aviso para pedir a abertura, sem o botão.

## Etapas

- [x] 1. Domínio: permissão `caixa.abrir`, papéis e histórias, com testes.
- [x] 2. API: abrir o caixa exige `caixa.abrir`; teste de integração.
- [x] 3. Front: Balcão e Caixa mostram "Abrir caixa" só com a permissão; teste de tela.
- [x] 4. Verificar: `pnpm verificar`, `api:integracao` e `verificar:layout`.

## Critérios de pronto

- O Barbeiro recebe 403 ao abrir o caixa e não vê o botão. A Recepção continua abrindo.
- Com o caixa aberto, o Barbeiro segue lançando avulso, fazendo check-in e recebendo.

## Registro de mudanças

- 2026-11-09 — Plano criado.
- 2026-11-09 — Implementado. Só o cartão de caixa fechado do Balcão mudou, porque a tela Caixa não aparece para o Barbeiro e os outros papéis com `caixa.operar` também têm `caixa.abrir`. Verificado: `pnpm verificar`, `api:integracao` (121) e `verificar:layout` (81). Branch `feat/0039-barbeiro-sem-abrir-caixa`, criada sobre o ajuste das abas (`228b49c`).
