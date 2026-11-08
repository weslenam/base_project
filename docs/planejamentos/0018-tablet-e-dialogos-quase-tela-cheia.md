# Planejamento 0018: Responsividade em tablet e diálogos quase em tela cheia

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam
- **Relacionado:** skill `design-system`; planejamentos 0011, 0016
- **Commits:** ainda não commitado

## Solicitação de origem

> revise quando usado em tablet porque esta com problema de responsividade, os modais precisam ser melhorados pra mim eles podem ser "quase" fullscreen

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente, com captura da agenda.
- **Esclarecimentos:** nenhum.

## Objetivo

- Páginas ocupam a largura disponível. Hoje o `DsPagina` limita a 80rem e sobra uma faixa vazia à direita em telas largas e tablets na horizontal.
- Diálogos grandes (`lg`, `xl`) ficam **quase em tela cheia** em qualquer tela.
- Os médios (`md`) ficam quase em tela cheia em tablet e celular (até 80rem) e compactos no desktop.
- Os pequenos (`sm`: confirmação, advertência, negação e formulários curtos) continuam compactos.
- Fora do escopo: redesenhar o conteúdo de cada diálogo.

## Decisões e restrições

- **Regra de tamanho centralizada.** Fica no `DsDialogo` (lib), sem CSS solto nas telas. O tamanho sai de classes próprias no conteúdo do diálogo e de `data-largura` no cartão. A prop `max-width` do Vuetify deixa de ser usada, para a regra ficar toda no CSS.
- **Margem em volta:** `clamp(12px, 2vw, 32px)`, o "quase" da tela cheia.
- **Quase em tela cheia:**
  - título e ações ficam fixos;
  - só o corpo rola, e só se o conteúdo não couber (tablet em pé).
- **Limite de tablet: 80rem (1280px).** É o mesmo ponto em que o menu lateral vira gaveta.

## Etapas

- [x] 1. `DsDialogo`: tamanhos `sm` (compacto), `md` (compacto no desktop, quase tela cheia até 80rem), `lg`/`xl` (quase tela cheia); corpo com rolagem interna; contrato.
- [x] 2. `DsPagina` sem limite de 80rem.
- [x] 3. Telas: listas com altura fixa em `vh` (comanda, cliente) passam a acompanhar o espaço do diálogo.
- [x] 4. `pnpm verificar`; commit.

## Critérios de pronto

- `pnpm verificar` passa.
- No tablet (1024×768 e 768×1024), comanda, cliente, detalhe do agendamento e pacote abrem quase em tela cheia, sem cortar as ações.

## Riscos e pendências

- Sem navegador aqui: a conferência visual fica com o usuário.

## Registro de mudanças

- 2026-11-07: plano criado.
