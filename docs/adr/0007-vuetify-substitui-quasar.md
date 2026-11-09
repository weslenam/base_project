# ADR 0007: Vuetify substitui o Quasar

- **Status:** Aceito (substitui o Quasar adotado no protótipo Agenda)
- **Data:** anterior a 2026-11-07 (protótipo Agenda). Reconstruído em 2026-11-07 a partir da skill `design-system`.

## Contexto

No protótipo Agenda, a UI usava o Quasar atrás dos wrappers `Ds*` (as telas só conhecem `@barbertime/ui`). O produto precisa de componentes pesados (tabela de dados, autocomplete) e de um calendário. O Vuetify cobre tudo isso nativamente com `VDataTable`, `VAutocomplete` e `VCalendar`.

## Decisão

- **Vuetify 4** como framework de UI, implementado em `libs/ui-vuetify` atrás do mesmo contrato `Ds*`.
- **ApexCharts** (`vue3-apexcharts`) para gráficos, atrás do `DsGrafico`.
- **Não misturar suítes completas.** Exceções pontuais (ex.: TreeTable do PrimeVue em modo unstyled) seguem `references/excecoes-de-biblioteca.md` da skill.
- **A lib `ui-quasar` foi removida.** Ela volta só para testar outra troca.

## Consequências

- `instalarUi` registra o Vuetify e monta o tema a partir dos tokens de `@barbertime/ui-tokens`, gerados da identidade visual ([ADR 0003](0003-identidade-visual-e-tokens.md)).
- Os exemplos em Quasar das referências da skill valem pelos princípios; o código de referência atual está em `libs/ui-vuetify/src/`.
