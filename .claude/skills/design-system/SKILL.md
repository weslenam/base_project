---
name: design-system
description: Arquitetura e regras do design system Vue 3 (JavaScript, sem TypeScript) em workspace Nx, com componentes Ds* e composables que embrulham o framework de UI (Vuetify hoje, ADR 0007; Quasar ou outro amanhã) atrás de um contrato próprio. Use SEMPRE que for criar, alterar ou revisar componentes de interface, telas, formulários, tabelas, diálogos, notificações, layout, tokens de tema ou a lib @barbertime/ui; quando alguém pedir para usar Quasar, Vuetify, PrimeVue ou outra biblioteca de componentes; ao gerar telas novas em apps Vue do workspace; ou ao discutir trocar o framework de UI. Mesmo que o pedido não mencione "design system", se envolve UI Vue neste workspace, siga esta skill.
---

# Design System Vue com wrappers

Esta skill define como a interface dos apps Vue do workspace é construída. A ideia central é: **consumir o framework de UI sem depender dele**. As telas falam só com a nossa lib (`@barbertime/ui`); a lib fala com o framework. Assim dá para trocar Quasar por Vuetify (ou outro) reimplementando a lib, sem tocar nas telas.

## Decisões já tomadas

- **Vue 3 com `<script setup>`, JavaScript puro.** Não usar TypeScript.
- **Framework base: Vuetify 4** (ADR 0007, que substituiu o Quasar do protótipo Agenda). Cobre os componentes pesados (VDataTable, VAutocomplete) e traz o `VCalendar`, usado no `DsCalendario`.
- **Gráficos: ApexCharts** (`vue3-apexcharts`), também atrás de wrapper (`DsGrafico`).
- **Não misturar suítes completas.** Vuetify + PrimeVue + outra suíte ao mesmo tempo gera conflito de CSS global, overlays/z-index, tema duplicado e comportamento inconsistente. Exceção só para um componente que o Vuetify não cubra bem (ex.: TreeTable, organograma) — ver `references/excecoes-de-biblioteca.md`.
- **Identidade visual vem dos tokens**, não das cores padrão do framework.

## Arquitetura

```
App (telas)
   ↓ importa só @barbertime/ui
@barbertime/ui  (alias → implementação ativa)
   ├── componentes Ds*   (DsBotao, DsInput, DsTabela, DsLayout...)
   └── composables       (useNotificacao, useConfirmacao...)
   ↓
Framework de UI (Vuetify hoje)
```

Estrutura de libs no Nx:

```
libs/
  ui-tokens/     → variáveis CSS (cores, espaços, raios, sombras, fontes, tema claro/escuro)
  ui-utils/      → formatarData, formatarMoeda, validarCnpj... (sem framework, usa Intl/dayjs)
  ui-vuetify/    → implementação dos Ds* e composables com Vuetify  (ATIVA)
  (ui-quasar foi removida no ADR 0007; recriar só para testar outra troca)
  ui-contrato/   → testes de contrato que toda implementação precisa passar
```

O app nunca importa `ui-vuetify` direto. Um alias no Vite escolhe a implementação — detalhes em `references/troca-de-framework.md`.

## As regras do contrato

O contrato é o que torna a troca possível. Se ele "vazar" o framework, a troca vira reescrita. Por isso:

1. **API com nomes nossos, em português.** Props, eventos e slots são nossos: `linhas`, `colunas`, `carregando`, `@selecionar` — nunca `rows`, `columns`, `loading`, `@row-click` repassados crus.
2. **Slots entregam dados no nosso formato.** Nunca repassar o objeto de slot do framework (`props.row`, `props.col`). Montar `{ linha, coluna, valor }`.
3. **Variantes fechadas.** `DsBotao` aceita `variante="primario | secundario | perigo"` e `tamanho="sm | md | lg"`, não as dezenas de props do QBtn. Isso garante consistência visual.
4. **Layout também é embrulhado.** `DsLayout`, `DsMenuLateral`, `DsPagina`, `DsCabecalho` por cima de QLayout/QDrawer/QPage.
5. **Nada do framework nas telas:** sem imports de `vuetify`, sem classes utilitárias (`pa-4`, `d-flex`, `text-primary`), sem diretivas (`v-close-popup`, `v-ripple`), sem utilitários (`date.formatDate`). Nas telas, usar classes próprias baseadas em tokens (`ds-p-md`, `ds-grid`) ou CSS scoped, e `@barbertime/ui-utils` para formatação.
6. **Plugins e composables do framework ficam atrás de composables nossos** (`useNotificacao` sobre `$q.notify`, `useConfirmacao` sobre `$q.dialog`). Ver `references/composables.md`.
7. **Textos padrão em pt-BR dentro da lib** ("Nenhum registro encontrado", "Cancelar", "Confirmar").
8. **Porta de entrada única.** Tudo exportado por `src/index.js`, incluindo `instalarUi(app)`, que registra o framework e seus plugins. Os apps não sabem qual framework existe.
9. **Wrapper de estilo usa só tokens.** Nenhuma cor, espaçamento ou raio fixo dentro dos componentes; sempre `var(--token)`.

Para garantir as regras 1–5 também quando o código for gerado por IA, aplique o bloqueio de imports via ESLint (`no-restricted-imports` ou `@nx/enforce-module-boundaries`) — exemplo em `references/troca-de-framework.md`.

## Quando criar um wrapper novo

Não embrulhar tudo de uma vez. Começar pelo kit base: **DsBotao, DsInput, DsSelect, DsTabela, DsDialogo, useNotificacao, useConfirmacao, DsLayout**. Criar um novo `Ds*` quando um componente do framework aparecer pela segunda ou terceira vez em telas. Componentes com regra de negócio brasileira são prioridade, pois são reaproveitados entre sistemas: `DsInputCnpj`, `DsInputCpf`, `DsInputMoeda`, `DsSelectUf`, `DsInputCep`.

## Checklist ao criar ou alterar um componente Ds\*

1. Definir a API (props, eventos, slots) em português, sem nomes do framework.
2. Implementar em `libs/ui-vuetify/src/componentes/DsNome.vue`, estilizando só com tokens.
3. Traduzir eventos e formatos de slot para o contrato.
4. Exportar em `libs/ui-vuetify/src/index.js`.
5. Escrever o teste de contrato em `libs/ui-contrato/` e ligá-lo à implementação Vuetify.
6. Documentar no catálogo (Histoire) com as variantes.

Exemplos completos de componentes (DsBotao, DsTabela, DsInputCnpj) em `references/componentes.md`.

## Ao gerar telas

- Importar apenas de `@barbertime/ui` e `@barbertime/ui-utils`.
- Se faltar um componente, não usar o do framework "só desta vez": criar o `Ds*` seguindo o checklist (ou sinalizar que ele precisa ser criado).
- Notificações e confirmações sempre pelos composables (`useNotificacao`, `useConfirmacao`).

## Referências

- `references/componentes.md` — exemplos de DsBotao, DsTabela, DsInputCnpj e tokens. Ler ao criar ou revisar componentes.
- `references/composables.md` — composables wrapper e `instalarUi`. Ler ao lidar com notificação, diálogo, loading ou instalação da lib.
- `references/troca-de-framework.md` — alias UI_IMPL, testes de contrato, lint de fronteira e passo a passo para testar Vuetify. Ler ao configurar o workspace ou planejar a troca.
- `references/excecoes-de-biblioteca.md` — quando e como trazer um componente pontual de outra biblioteca (PrimeVue unstyled).
