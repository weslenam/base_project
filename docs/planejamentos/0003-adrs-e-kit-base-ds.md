# Planejamento 0003: ADRs de base e kit `Ds*` com Vuetify

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0001, 0002 e 0004, ADRs 0006, 0007 e 0008, skill `design-system`
- **Commits:** 527a020 (branch `feat/kit-base-ds`)

## Solicitação de origem

> temos o que precisamos para implementar?

> sim pode iniciar as fases de implementacao

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Na resposta à primeira mensagem, o assistente apontou o que falta para o produto (escopo funcional, identidade visual, banco, autenticação, ADRs). Propôs que o usuário descreva o produto e que, enquanto isso, o assistente recrie os ADRs e implemente o kit `Ds*`. O usuário respondeu com a segunda mensagem.
  - A identidade visual ainda não existe. → Os componentes usam apenas tokens; os valores continuam provisórios.

## Objetivo

Adiantar o que não depende do escopo do produto:

1. Recriar no repositório os ADRs citados pelas regras e skills (0003, 0006, 0007) e registrar as decisões novas do esqueleto (0008).
2. Instalar o Vuetify em `libs/ui-vuetify` e implementar o kit base da skill `design-system`, com testes de contrato em `libs/ui-contrato`.

**Fora do escopo:** telas de negócio, banco, autenticação, preferências (tela, catálogo e API), identidade visual definitiva, catálogo Histoire e componentes com regra brasileira (`DsInputCpf` etc.).

## Decisões e restrições

- **Vuetify 4.3.0** fixo (publicado há mais de duas semanas). Componentes importados explicitamente de `vuetify/components`, sem plugin de auto-import.
- **Ícones: iconset `mdi-svg` do Vuetify.** SVG embutido, sem fonte de ícones nem CDN.
- **Tokens com uma fonte da verdade em JS** (`libs/ui-tokens/src/tokens.js`). O `tokens.css` espelha esses valores, e um teste garante que os dois estão iguais. O tema do Vuetify é montado a partir do JS em `instalarUi`.
- **Hosts globais em `DsApp`.** O Vuetify exige `VApp` na raiz. `DsApp` embrulha o `VApp` e renderiza as filas de notificação e confirmação, que ficam num estado de módulo. Assim `useNotificacao` e `useConfirmacao` funcionam também fora do `setup`.
- **Kit:** DsApp, DsLayout, DsBotao, DsInput, DsSelect, DsTabela, DsDialogo, `useNotificacao`, `useConfirmacao` e `useTema`. O `useTema` só aplica o efeito visual; a escolha do tema é uma preferência e fica para quando existir a central.
- **API em português, variantes fechadas, slots no nosso formato** (contrato da skill).

## Etapas

- [x] 1. ADRs: `docs/adr/` com README e os ADRs 0006 (preferências), 0007 (Vuetify) e 0008 (workspace JS + Fastify). O ADR do Quasar, que seria o 0003, foi descartado: o número já era da identidade visual.
- [x] 2. Tokens: `tokens.js` (claro e escuro), `tokens.css` sincronizado e teste de sincronia.
- [x] 3. Instalar `vuetify` em `ui-vuetify` e criar o `instalarUi` real (tema, locale pt-BR, ícones).
- [x] 4. Composables: `useNotificacao`, `useConfirmacao`, `useTema`.
- [x] 5. Componentes: DsApp, DsLayout, DsBotao, DsInput, DsSelect, DsTabela, DsDialogo.
- [x] 6. Contratos em `ui-contrato` para cada item e specs em `ui-vuetify` ligando os contratos.
- [x] 7. App: `App.vue` com DsApp e DsLayout; vitrine do kit na rota `/componentes`.
- [x] 8. Nota em `references/componentes.md` apontando para os tokens reais (`--ds-*`). As outras referências já apontam para `libs/ui-vuetify/src/`.
- [x] 9. Verificar com `pnpm verificar`. As rotas compilam no dev server; a conferência visual fica com o usuário (não há navegador no ambiente).

## Critérios de pronto

- `pnpm verificar` passa.
- Cada `Ds*` e composable tem teste de contrato passando na implementação Vuetify.
- `pnpm nx serve barbertime` mostra o layout com menu, botão, notificação e confirmação funcionando.
- O lint continua bloqueando `vuetify` no app.

## Riscos e pendências

- A Vuetify em jsdom pede polyfills (`ResizeObserver`, `visualViewport`). Ficam no setup de testes da lib.
- Histoire pode não suportar Vite 8; o catálogo fica para depois. A vitrine `/componentes` cobre a conferência manual por enquanto.
- Bundle: 458 kB de JS (156 kB gzip) num único chunk, porque o índice da lib reexporta tudo. Avaliar divisão quando houver mais telas.
- `vuetify/styles` foi trocado por `styles/layers` + `styles/core`: as classes utilitárias (240 kB) são proibidas nas telas e nenhum componente usado depende delas. O CSS caiu de 331 kB para 154 kB.
- O escopo do produto chegou de outra sessão (planejamento 0001 e `docs/definicao-e-escopo.md`).

## Registro de mudanças

- 2026-11-07: Plano criado após o "pode iniciar as fases de implementacao".
- 2026-11-07: `@mdi/js` removido do plano; o iconset `mdi-svg` do Vuetify já embute os ícones internos.
- 2026-11-07: Imports por componente (`vuetify/components/VBtn`) e só o CSS de núcleo.
- 2026-11-07: Concluído. 88 testes (37 de contrato), lint e build passam.
- 2026-11-07: Renumerado de 0002 para 0003. Os tokens provisórios (`tokens.js` à mão, `--ds-*`) foram substituídos pela identidade visual no planejamento 0004.
