# Planejamento 0032: Testes de layout com Playwright

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** ADR 0020 (novo); planejamento 0031
- **Commits:** ainda não commitado

## Solicitação de origem

> conseguimos deixar o chormium para poder fazer testes e analisar?

> então adiciona alguma adr para layout realizar testes usando o playwrite

> faça o teste de regreção usando o playwrite em todo o front

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente

## Objetivo

Ter um navegador real (Chromium headless) no ambiente para:

- testar o layout das telas em celular, tablet e desktop;
- o assistente conferir capturas de tela antes de entregar mudanças de UI.

**Fora do escopo:**

- comparação pixel a pixel com imagem base;
- testes ponta a ponta de regra de negócio;
- outros navegadores.

## Decisões

As decisões estão no ADR 0020:

- projeto `apps/e2e-layout`;
- três larguras;
- quatro checagens (sem rolagem horizontal, nada vazando do contêiner, elementos visíveis e captura);
- comando `pnpm verificar:layout`, fora do `pnpm verificar`.

## Etapas

- [x] 1. Playwright no workspace e Chromium baixado (`~/.cache/ms-playwright`).
- [x] 2. Bibliotecas do sistema do Chromium: sem `sudo`, extraídas de `.deb` em `~/.cache/pw-libs` pelo `pnpm navegador`.
- [x] 3. Projeto `apps/e2e-layout`:
  - `playwright.config.js` com as três larguras;
  - apoio de login (usuário e operador com TOTP de desenvolvimento);
  - checagens reaproveitáveis (`semRolagemHorizontal`, `cabeNoPai`).
- [x] 4. Primeiros specs:
  - Business Center (lista e painel da barbearia);
  - app (Balcão, Agenda, Caixa, Clientes e menu lateral).
- [x] 5. `pnpm verificar:layout`, regra no fluxo de trabalho (etapa de UI) e README.
- [x] 6. Rodar, corrigir o que quebrar e fechar (ADR para "Aceito", índices e commit).

## Critérios de pronto

- `pnpm verificar:layout` verde nas três larguras, com o ambiente de desenvolvimento no ar.
- Capturas geradas em `apps/e2e-layout/capturas/` (no `.gitignore`).

## Riscos e pendências

- Sem as bibliotecas do sistema, o Chromium não abre no WSL. Depende do `sudo` do Weslen.
- Os testes dependem do `pnpm dev` e da semente. A ordem dos dados pode mudar com o tempo, então os specs evitam depender de valores exatos.

## Registro de mudanças

- 2026-11-08: criado. Playwright adicionado e Chromium baixado; faltam as bibliotecas do sistema.
- 2026-11-08: implementado ("faça o teste de regreção usando o playwrite em todo o front").
  - **Sem `sudo`:** o `scripts/preparar-navegador.sh` (`pnpm navegador`) extrai as bibliotecas do Chromium em `~/.cache/pw-libs`.
  - **Cobertura:** `apps/e2e-layout` com 26 telas × 3 larguras (78 testes).
    - App: 17 telas logado como Dono, mais o menu aberto.
    - 5 telas públicas.
    - Business Center: 3 telas.
    - As telas de módulo inativo (Estoque, Compras e Fornecedores) são puladas.
  - **Checagens:** sem rolagem horizontal, nada além da borda direita, texto que não vaza da própria caixa, sem erro de JavaScript, mais a captura de tela.
  - **O que a primeira rodada achou (10 falhas, todas no celular e no tablet):**
    - **`DsPagina` e `DsFormulario`:** grids sem coluna que encolhe; tabelas e abas largas alargavam a página. Correção: `grid-template-columns: minmax(0, 1fr)`.
    - **`DsTabela`:** limite de largura; a tabela rola dentro do cartão.
    - **`DsAbas`:** a lista rola de lado no celular; o sublinhado passou a ser sombra interna.
    - **`DsBlocoAgenda`:** o texto só para leitor de tela (absoluto) escapava do quadro com rolagem e alargava a Agenda em 157px. Correção: `position: relative` no bloco.
  - **Revisão das capturas:**
    - os filtros do Business Center empilhavam numa coluna (base flexível no `DsEscolha` da tela);
    - o espaço entre ícone e texto do menu era grande demais.
  - **Sessão:** o setup reaproveita a sessão salva enquanto ela vale, para não esbarrar no limite de logins nem no TOTP de uso único.
  - **Resultado:** `pnpm verificar:layout` com 69 verdes e 9 pulados, estável em execuções seguidas.
