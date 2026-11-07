# BarberTime

**SaaS multi-tenant de agendamento e gestão para barbearias**, feito para o mercado brasileiro. Reúne a agenda por barbeiro, o atendimento pelo WhatsApp, a fila de quem chega sem hora marcada, o caixa com comissões e as assinaturas que a barbearia vende aos seus clientes.

> A barbearia para de agendar "na mão" no WhatsApp, reduz faltas e passa a ter receita recorrente com planos, sem juntar três sistemas diferentes.

Definição completa (público, planos, requisitos, riscos e métricas) em [docs/definicao-e-escopo.md](docs/definicao-e-escopo.md). Roadmap no [planejamento 0001](docs/planejamentos/0001-escopo-e-roadmap.md).

## Produto

### MVP (fase 1)

1. Agenda por barbeiro, com serviços de duração diferente e bloqueio de horários
2. Agendamento online pelo cliente, pela página pública `barbertime.com.br/<slug>`
3. Lembrete e confirmação automáticos
4. Cadastro de clientes com histórico e observações
5. Caixa e comanda: serviços, produtos e forma de pagamento
6. Comissão por profissional
7. Relatórios de faturamento e dos serviços mais vendidos

Plataforma SaaS, também no MVP: cadastro self-service com teste grátis, usuários e papéis por barbearia, isolamento de dados (ADR 0001), cobrança por plano e painel do super admin.

### Diferenciais (fases 2 a 4)

| Fase | Diferencial                                                                                 |
| ---- | ------------------------------------------------------------------------------------------- |
| 2    | WhatsApp primeiro (agendamento, lembretes, avisos) e assinatura ou clube integrado à agenda |
| 3    | Fila para quem chega sem hora, lista de espera automática e promoção de horário vazio       |
| 4    | Fidelidade ou cashback, campanhas de retorno e NFS-e a partir da comanda                    |

### Conceitos do domínio

| Termo                  | Significado                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Barbearia** (tenant) | Cliente do SaaS. Todo dado de negócio pertence a uma barbearia (`barbearia_id`) e é isolado por RLS.               |
| **Unidade**            | Endereço físico de uma barbearia. Redes têm várias; fuso horário e agenda são por unidade.                         |
| **Profissional**       | Barbeiro que atende, com horário de trabalho, serviços que executa e regra de comissão.                            |
| **Serviço**            | O que se vende na agenda (corte, barba...), com duração e preço próprios.                                          |
| **Agendamento**        | Reserva de um serviço com um profissional num horário. Estados: pendente, confirmado, atendido, faltou, cancelado. |
| **Bloqueio**           | Período em que o profissional não atende (almoço, folga).                                                          |
| **Encaixe**            | Atendimento colocado num intervalo livre entre agendamentos, geralmente vindo da fila.                             |
| **Fila**               | Ordem de quem chegou sem hora marcada, com estimativa de espera (fase 3).                                          |
| **Comanda**            | Conta do atendimento: serviços e produtos, desconto e forma de pagamento. Alimenta caixa e comissão.               |
| **Caixa**              | Abertura, movimentos e fechamento do dia, conferido por forma de pagamento.                                        |
| **Comissão**           | Parte do profissional sobre serviços e produtos (percentual ou valor fixo), fechada por período.                   |
| **Plano do SaaS**      | O que a barbearia paga ao BarberTime (Solo, Equipe, Pro, Rede), com limites por plano.                             |
| **Plano do cliente**   | Assinatura ou clube que a barbearia vende ao seu cliente final (fase 2).                                           |

## Preparar a máquina

O desenvolvimento acontece **dentro do WSL 2** (ADR 0002), com o repositório no sistema de arquivos do Linux (`~/projetos/barbertime`), nunca em `/mnt/c`.

1. WSL 2 com Ubuntu e Docker (Docker Desktop com integração WSL ou Docker Engine no Ubuntu).
2. `git config --global core.autocrlf input`. O `.gitattributes` força LF.
3. Node 22 via nvm (`nvm install` lê o `.nvmrc`) e pnpm via corepack (`corepack enable`).
4. VS Code aberto pelo WSL (`code .` no terminal do Ubuntu).

## Primeiros passos

```bash
nvm use
corepack enable
pnpm install
cp .env.example .env        # ajuste as senhas
docker compose up -d        # postgres, redis e mailpit
pnpm dev                    # web http://localhost:4200 · api http://localhost:3333
```

O Vite repassa `/api/*` para a API. O Mailpit mostra os e-mails do ambiente em http://localhost:8025. Para rodar também a api e a web em containers: `docker compose --profile apps up`.

## Comandos

| Comando                                  | O que faz                                                         |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                               | `nx serve` do `barbertime` e da `api` juntos                      |
| `pnpm verificar`                         | lint + testes + build de todos os projetos                        |
| `pnpm test` / `pnpm lint` / `pnpm build` | cada etapa isolada                                                |
| `pnpm format`                            | Prettier no workspace                                             |
| `pnpm nx run ui-tokens:gerar`            | regera os tokens a partir de `docs/identidade-visual/tokens.json` |
| `docker compose up -d` / `down`          | sobe ou para a infraestrutura (`down -v` zera os dados)           |
| `pnpm nx graph`                          | grafo de dependências                                             |

## Estrutura

```
apps/
  barbertime/   → app Vue 3 + Vite + Vue Router (porta 4200)
    src/telas/  → telas do MVP (agenda, caixa, clientes, equipe, serviços, produtos, agendamento público)
    src/dados/  → camada de dados: hoje em memória com exemplos; amanhã, chamadas à API
  api/          → Fastify, rotas sob /api (porta 3333), roda direto no Node
libs/
  dominio/      → regras de negócio puras compartilhadas por app e API (horários, caixa e comanda)
  ui-tokens/    → tokens gerados do tokens.json, fontes self-hosted e base tipográfica
  ui-utils/     → formatação e máscaras brasileiras: datas, moeda, telefone, CPF (sem framework)
  ui-vuetify/   → implementação ativa (Vuetify 4) dos Ds* e composables (alias @barbertime/ui)
  ui-contrato/  → testes de contrato que toda implementação de UI precisa passar
docker/         → scripts de inicialização dos serviços (postgres/init.sql)
docs/
  definicao-e-escopo.md → o que é o produto
  identidade-visual/    → marca: tokens.json (fonte única), logos, referência visual
  adr/                  → decisões arquiteturais
  planejamentos/        → planos de trabalho com a solicitação de origem
```

## Identidade visual

Industrial e urbana: concreto, grafite e cobre; Big Shoulders nos títulos, Barlow na interface e IBM Plex Mono em horários e valores; cantos vivos ([ADR 0003](docs/adr/0003-identidade-visual-e-tokens.md), [guia](docs/identidade-visual/README.md)).

- **Mudar cor, espaço ou fonte:** edite `docs/identidade-visual/tokens.json` e rode `pnpm nx run ui-tokens:gerar`. Um teste falha se os arquivos gerados ficarem desatualizados.
- Variáveis com o nome do token: `var(--cobre)`, `var(--esp-4)`, `var(--raio-sm)`, `var(--tipo-titulo)`. O tema escuro troca por `[data-theme='dark']`.
- Classes de apoio para telas: `ds-display`, `ds-titulo`, `ds-subtitulo`, `ds-rotulo`, `ds-corpo-lg`, `ds-corpo-sm`, `ds-suave`, `ds-hora`, `ds-valor`.

## Telas

| Rota             | Tela                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/agenda`        | Agenda do dia: colunas por barbeiro, navegação de dias, novo agendamento, bloqueio de horário e detalhes (confirmar presença, marcar atendido ou falta, cancelar) |
| `/clientes`      | Busca por nome ou telefone, cadastro com telefone, CPF e observações, histórico e exclusão                                                                        |
| `/servicos`      | Serviços (duração, preço) e equipe (expediente, comissão)                                                                                                         |
| `/agendar/:slug` | Página pública do cliente final (ex.: `/agendar/barbearia-modelo`): serviço → barbeiro → dia → horário → dados                                                    |
| `/componentes`   | Vitrine do kit de UI                                                                                                                                              |

**Dados de exemplo:** até a API de negócio existir, as telas usam `src/dados/api.js`, em memória (Barbearia do Zé, 3 barbeiros, 4 serviços, 4 produtos, 8 clientes, caixa do dia aberto com 3 comandas). Recarregar a página volta ao exemplo. As recusas de negócio (horário ocupado, telefone repetido, exclusão em uso) chegam como `ErroDeNegocio` e aparecem no diálogo de negação.

## Kit de UI (`@barbertime/ui`)

**Estrutura e formulários**

| Item                             | Para quê                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DsApp`                          | raiz obrigatória: tema, notificações e diálogos                                                            |
| `DsLayout`                       | cabeçalho com slot `marca`, menu lateral (`itensMenu: [{ titulo, rota, icone? }]`) e conteúdo              |
| `DsPagina`                       | cabeçalho de tela: `titulo`, `sobretitulo`, slot `acoes`                                                   |
| `DsCartao`                       | superfície com `titulo`, conteúdo e slots `acoes` e `cabecalho-acoes`                                      |
| `DsDialogo`                      | `v-model`, `titulo`, `largura` (sm/md/lg), slot `acoes`                                                    |
| `DsFormulario`                   | valida tudo e só emite `enviar` se válido; `DsBotao formulario="id"` envia de fora (ex.: ações do diálogo) |
| `DsInput` / `DsSelect`           | `rotulo`, `obrigatorio`, `regras`, `erro`; `tipo` inclui `data` e `hora`; `opcoes: [{ valor, rotulo }]`    |
| `DsTextarea`                     | texto longo com `rotulo`, `maxCaracteres`, `obrigatorio`                                                   |
| `DsInputTelefone` / `DsInputCpf` | máscara e validação; o modelo guarda só dígitos                                                            |
| `DsInputMoeda`                   | valor em reais digitado como centavos; o modelo é número                                                   |

**Ações e exibição**

| Item            | Para quê                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `DsBotao`       | `variante` primario/secundario/perigo/fantasma, `tamanho` sm/md/lg                                     |
| `DsAcao`        | botão de ação estilo PDV (ícone, título, descrição; primario/secundario/perigo), para painéis de ações |
| `DsIcone`       | ícone por nome do catálogo (`agenda`, `caixa`, `clientes`, `whatsapp`...; ver `NOMES_DE_ICONES`)       |
| `DsSelo`        | status com palavra: confirmado, pendente, assinante, fila, faltou, neutro                              |
| `DsTabela`      | `colunas: [{ campo, titulo, formatar? }]`, `@selecionar`, slot `celula-<campo>`                        |
| `DsHorarios`    | escolha de horário: `opcoes: [{ hora, disponivel }]`, `v-model` com a hora                             |
| `DsBlocoAgenda` | bloco da agenda: `cliente`, `servico`, `inicio`, `fim`, `estado`, `clicavel`                           |

**Composables**

| Item               | Para quê                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `useDialogo()`     | `confirmar` (sim/não → boolean), `advertir` (Voltar/Continuar → boolean), `negar` (só "Entendi") |
| `useConfirmacao()` | atalho de `useDialogo().confirmar`                                                               |
| `useNotificacao()` | `.sucesso()`, `.erro()`, `.aviso()`, `.info()`                                                   |
| `useTema()`        | aplica o tema claro/escuro (a escolha é preferência, ADR 0006)                                   |

Vitrine em `/componentes` no app. Os contratos de comportamento ficam em `libs/ui-contrato`.

## Regras do workspace

- **UI:** telas importam só de `@barbertime/ui` e `@barbertime/ui-utils` (skill `design-system`). O ESLint bloqueia `vuetify` e `@barbertime/ui-vuetify` no app.
- **Multi-tenant:** toda tabela de negócio tem `barbearia_id` e RLS. A API usa o papel `barbertime_app`, sem BYPASSRLS (ADR 0001).
- **Fronteiras:** `scope:front` e `scope:back` não se importam; código comum vai para uma lib `scope:shared`. Libs `type:ui` só dependem de outras `type:ui`.
- **Preferências:** seguem `.claude/rules/central-de-preferencias.md` (ADR 0006).
- **Planejamento:** todo plano vira documento em `docs/planejamentos/` (skill `planejamento-documentado`).
- **Geradores Nx:** sempre com `--js` (e `--bundler=none` para libs), para não reintroduzir TypeScript (ADR 0008).

## Configuração dos agentes de IA

`.claude/`, `.agents/`, `.cursor/`, `.github/`, `.opencode/`, `.codex/` e `.gemini/` trazem skills e instruções (Nx, design system, planejamento) para os assistentes de código.
