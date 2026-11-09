# ADR 0020: Testes de layout com Playwright (Chromium)

- **Status:** Aceito
- **Data:** 2026-11-08
- **Relacionado:**
  - ADRs 0003 (identidade visual e tokens), 0007 (Vuetify atrás dos `Ds*`) e 0018 (Business Center);
  - planejamentos 0031 e 0032;
  - skill `design-system`.

## Contexto

Os testes de tela rodam no Vitest com jsdom. Eles conferem texto, eventos e contrato dos componentes, mas jsdom **não calcula layout**: não há largura, quebra de linha nem rolagem. Por isso, problemas visuais só aparecem quando alguém abre a tela, como o valor que vazava do cartão no painel do Business Center (planejamento 0031). Também não havia navegador no ambiente para o assistente conferir a tela antes de entregar.

## Decisão

- **Ferramenta:**
  - **Playwright** (`@playwright/test`) com **Chromium** headless;
  - o navegador é baixado pelo próprio Playwright, sem depender do Chrome instalado;
  - nada de outros navegadores por enquanto.
- **Onde fica:**
  - projeto Nx `e2e-layout` em `apps/e2e-layout/`, com specs em JavaScript (sem TypeScript, ADR 0008);
  - apoio para entrar como usuário de barbearia e como operador, este com o TOTP do segredo fixo de desenvolvimento (ADR 0018).
- **Contra o quê roda:**
  - o ambiente de desenvolvimento no ar (`pnpm dev`), com a semente aplicada (`api:semear`, com movimento de exemplo);
  - não sobe servidores por conta própria.
- **Larguras padrão (projetos do Playwright):**
  - celular: 390 × 844;
  - tablet: 820 × 1180;
  - desktop: 1440 × 900.
- **O que um teste de layout confere:**
  1. **sem rolagem horizontal** na página (`scrollWidth` ≤ largura da janela);
  2. **nada vazando do contêiner**: os elementos marcados (ex.: valor do `DsIndicador`, títulos de cartão) cabem na largura do pai;
  3. **elementos-chave visíveis** em cada largura (menu, ações da página);
  4. **captura de tela** de cada tela e largura em `apps/e2e-layout/capturas/` (fora do git), para revisão humana e do assistente.
- **Comparação pixel a pixel:**
  - fica para depois;
  - fontes e antialiasing variam entre máquinas, o que gera falso positivo;
  - só entra com imagem base gerada num ambiente fixo (CI).
- **Comando e fluxo:**
  - `pnpm verificar:layout` (`nx run e2e-layout:e2e`);
  - **fora** do `pnpm verificar`, porque precisa dos servidores no ar;
  - obrigatório no fluxo quando a mudança mexe em UI (`.vue`, `libs/ui-*`, tokens), antes da revisão de segurança;
  - quem muda uma tela inclui ou ajusta o spec de layout dela.
- **Ambiente:**
  - `pnpm navegador` prepara o Chromium uma vez;
  - com `sudo`, o melhor é `sudo pnpm exec playwright install-deps chromium`;
  - sem `sudo` (WSL), o script baixa os `.deb` com `apt-get download` e extrai as bibliotecas em `~/.cache/pw-libs/raiz`, que o `playwright.config.js` coloca no `LD_LIBRARY_PATH`.

## Consequências

- **Ganho:** problemas de layout (vazamento, rolagem horizontal, quebra no celular) passam a ter teste automatizado. O assistente também passa a enxergar a tela antes de entregar.
- **Custo:**
  - uns 130 MB de navegador em `~/.cache/ms-playwright`;
  - uma dependência de desenvolvimento nova (`@playwright/test`);
  - os testes dependem do ambiente de desenvolvimento estar no ar.
- **Escopo:** isto é teste de layout, não teste ponta a ponta de regra de negócio. As regras continuam nos testes do domínio e nos de integração da API.
