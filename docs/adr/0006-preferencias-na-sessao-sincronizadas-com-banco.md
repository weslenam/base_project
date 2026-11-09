# ADR 0006: Preferências na sessão, sincronizadas com o banco

- **Status:** Aceito
- **Data:** anterior a 2026-11-07 (protótipo Agenda). Reconstruído em 2026-11-07 a partir de `.claude/rules/central-de-preferencias.md`.

## Contexto

O usuário escolhe opções que precisam ser lembradas, como tema, paleta, idioma, densidade e visão padrão do calendário. Elas precisam aparecer na hora, valer entre recargas e acompanhar o usuário quando ele troca de navegador.

## Decisão

- **Catálogo fechado no backend.** Cada preferência tem `chave`, valor padrão e valores válidos. Chave ou valor fora do catálogo recebe 400.
- **Duas camadas.** A preferência é aplicada na hora, gravada no `localStorage` e sincronizada por `PUT /api/preferencias/:chave`.
- **O banco é a fonte da verdade na carga.** O cache local só evita que a tela pisque até a resposta chegar.
- **Acesso só por composable.** As telas usam `usePreferencias()`. A lib de UI aplica apenas o efeito visual (ex.: `useTema`) e não conhece a API.
- **Local único:** a tela `/preferencias` de cada app, mais atalhos que gravam pela mesma central.
- **Valor padrão sempre definido.** O app funciona sem nenhuma preferência gravada.

## Consequências

- Uma preferência nova exige mudar o catálogo do backend, o catálogo do front e a tela, além de testes de valor inválido, padrão e persistência.
- As preferências valem para a instalação. Preferências por usuário exigem um novo ADR.
