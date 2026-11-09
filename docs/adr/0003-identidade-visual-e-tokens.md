# ADR 0003: Identidade visual industrial-urbana e tokens como fonte única

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** [ADR 0001](0001-saas-multi-tenant.md), skill `design-system`, [identidade visual](../identidade-visual/README.md)
- **Design system publicado:** https://claude.ai/artifact/DCRWdd4DRgQEukznXyGyDK (privado; compartilhar pelo menu Share)

## Contexto

O BarberTime precisa de uma marca própria antes da primeira tela. Pedido: personalidade **industrial e urbana**, com logo e símbolo, paleta, tipografia e telas de exemplo. A interface Vue segue a skill `design-system` (componentes `Ds*` sobre o framework de UI), então a marca precisa entrar por tokens, nunca por valores soltos nas telas.

## Decisão

1. **Identidade adotada:** concreto, grafite e cobre; Big Shoulders (títulos e números, maiúsculas), Barlow (interface) e IBM Plex Mono (horários e valores); cantos vivos; uma cor de marca (`cobre`) e uma de alerta (`ambar`, exclusiva da fila e da hora atual). Detalhes e regras de uso em `docs/identidade-visual/README.md`.
2. **Fonte única de verdade:** `docs/identidade-visual/tokens.json` (cores com tema claro e escuro, tipografia, espaços, raios, sombra) e `docs/identidade-visual/logos/`. O design system publicado é a vitrine desses mesmos valores; uma mudança vale nos dois lugares no mesmo commit.
3. **Consumo no código** (fase 0):
   - `libs/ui-tokens` gera `tokens.css` a partir do `tokens.json` (variáveis com o mesmo nome do token: `--cobre`, `--esp-4`, `--raio-sm`), com `[data-theme="dark"]` para o tema escuro. Script de geração versionado; ninguém edita o CSS à mão.
   - O tema do Vuetify (ou do Quasar, se trocar) é montado a partir das mesmas variáveis dentro da lib de UI; telas não conhecem hex nem nomes do framework.
   - Componentes `Ds*` usam só tokens. As classes `bt-*` de `referencia-componentes.css` são modelo visual, não código de produção.
   - Fontes **servidas pelo próprio app** (pacotes Fontsource no npm, sem Google Fonts em produção), por desempenho e para não enviar dados dos clientes a terceiros (LGPD).
   - Logos copiados de `docs/identidade-visual/logos/` para os assets do app (favicon, ícone de PWA, página pública). Nunca redesenhar nem redigitar o logo.
4. **Acessibilidade como regra:** pares de texto com 4,5:1 nos dois temas, bordas de controle e foco com 3:1, alvos de toque com 44px, estado nunca só por cor.
5. **Marca da barbearia em primeiro lugar** na página pública de agendamento; o BarberTime assina só no rodapé. Personalização por barbearia (logo, cor de destaque) fica para um ADR futuro, ligado aos planos do SaaS.

## Consequências

- Uma única troca no `tokens.json` muda app, telas e documentação.
- Adicionar cor ou tamanho novo exige token novo (e checagem de contraste), não valor no componente.
- O design system publicado precisa ser atualizado junto; quem altera tokens atualiza os dois.
