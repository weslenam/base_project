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
pnpm banco                  # sobe postgres, redis e mailpit, migra e cria a barbearia modelo
pnpm dev                    # web http://localhost:4200 · api http://localhost:3333
```

**Acesso de desenvolvimento** (criado por `pnpm banco`, senha `barbertime123`): `dono@`, `gerente@`, `recepcao@` e `barbeiro@barbertime.dev`, um por papel. Para cadastrar outra barbearia, use `/cadastro`.

O Vite repassa `/api/*` para a API. O Mailpit mostra os e-mails do ambiente em http://localhost:8025. Para rodar também a api e a web em containers: `docker compose --profile apps up`.

## Comandos

| Comando                                  | O que faz                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev`                               | `nx serve` do `barbertime` e da `api` juntos                                               |
| `pnpm verificar`                         | lint + testes + build de todos os projetos                                                 |
| `pnpm test` / `pnpm lint` / `pnpm build` | cada etapa isolada                                                                         |
| `pnpm format`                            | Prettier no workspace                                                                      |
| `pnpm nx run ui-tokens:gerar`            | regera os tokens a partir de `docs/identidade-visual/tokens.json`                          |
| `pnpm verificar:tudo`                    | verificar + testes de integração da API (precisa do Postgres no Docker)                    |
| `pnpm nx run api:migrar` / `api:semear`  | aplica migrações / cria os dados de desenvolvimento (inclui a simulação da Studio Negoboy) |
| `docker compose up -d` / `down`          | sobe ou para a infraestrutura (`down -v` zera os dados)                                    |
| `pnpm nx graph`                          | grafo de dependências                                                                      |

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

## Acesso, papéis e módulos

- **Login** por sessão em cookie (ADR 0009). Cada usuário tem um **papel** em cada barbearia: Dono, Gerente, Recepção, Barbeiro ou papéis criados pelo dono com permissões do catálogo (ADR 0010). O menu mostra só o que o papel permite, e a API recusa o resto (403).
- **Isolamento por barbearia** com RLS no PostgreSQL (ADR 0001), coberto por teste de integração.
- **Módulos** (ADR 0011): inclusos no plano (agendamento online, comissões, lembretes) a barbearia ativa; **serviços adicionais** (pagamento online/gateway, WhatsApp, NFS-e, **fidelidade** e **pacotes**) são solicitados e ativados depois da contratação. A semente de desenvolvimento já ativa fidelidade e pacotes.
- **Já na API real** (planejamento 0019):
  - login, cadastro da barbearia, usuários, papéis e módulos;
  - configurações;
  - serviços, produtos, equipe, clientes e agenda;
  - página pública.

  - balcão, caixa e comandas (planejamento 0020).

  Fidelidade e pacotes ainda usam os dados de exemplo (parte 3).

## Telas

| Rota                                  | Tela                                                                                                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/balcao`                             | **Balcão** (planejamento 0020): Agora (barbeiros livre/ocupado/pausa) · Fila e chegadas (com espera prevista) · Próximos (check-in); **+ Avulso** em 3 toques; encaixe que não atropela agendados; finalizar → cobrar |
| `/agenda`                             | Agenda do dia: colunas por barbeiro, navegação de dias, novo agendamento, bloqueio de horário e detalhes (confirmar presença, marcar atendido ou falta, cancelar)                                                     |
| `/clientes`                           | Busca por nome ou telefone; cadastro em duas colunas com abas Resumo (serviços, produtos, total gasto, ticket médio, último serviço, fidelidade e pacotes), Comandas (5 por vez, "Ver mais") e Agendamentos           |
| `/servicos`                           | Serviços (duração, preço) e equipe (expediente, comissão)                                                                                                                                                             |
| `/agendar/:slug`                      | Página pública do cliente final (ex.: `/agendar/barbearia-modelo`), em etapas: serviço → barbeiro → dia → horário → dados                                                                                             |
| `/pacotes`                            | Pacotes de serviços: por quantidade ou livres, mensais ou de compra única, com intervalo mínimo e/ou máximo por semana (módulo Pacotes)                                                                               |
| `/fidelidade`                         | Cartão de selos e/ou cashback (módulo Fidelidade)                                                                                                                                                                     |
| `/configuracoes`                      | Administração (Dono): dados da barbearia, endereço público, horário de funcionamento e regras do agendamento online                                                                                                   |
| `/usuarios`                           | Quem tem acesso à barbearia e com qual papel; convidar, trocar papel, desativar e remover só quem está abaixo na hierarquia (Dono e Gerente)                                                                          |
| `/papeis`                             | Hierarquia fixa Dono > Gerente > Recepção > Barbeiro e as permissões de cada papel, só leitura (ADR 0010)                                                                                                             |
| `/modulos`                            | Módulos inclusos e serviços adicionais                                                                                                                                                                                |
| `/perfil`                             | Meu perfil (todo usuário): nome, trocar senha e trocar de barbearia; abre pelo nome no cabeçalho                                                                                                                      |
| `/entrar` · `/cadastro`               | Login e cadastro self-service da barbearia                                                                                                                                                                            |
| `/esqueci-senha` · `/redefinir-senha` | Recuperação de senha por e-mail, com link de uso único que vale 1 hora (no dev, o e-mail aparece no Mailpit: http://localhost:8025)                                                                                   |

**Cliente no balcão (comanda e novo agendamento):** um campo aceita nome ou telefone. Com letras, busca pelo nome; com números, pelo telefone (os últimos 4 dígitos já bastam). Quem começa com o nome ou termina com os dígitos aparece primeiro. Se nada for encontrado, dá para cadastrar ali mesmo, com o que foi digitado já preenchido. O botão "Procurar na lista" abre todos os clientes com atendimentos, última visita e faltas. Na comanda, deixar sem cliente grava como **cliente avulso**: entra no caixa e na comissão do barbeiro, mas não vai para o histórico de ninguém. O agendamento sempre exige cliente.

**Fidelidade e pacotes no balcão:** o cadastro do cliente mostra os selos, o cashback e os pacotes com saldo por serviço, além de "Vender pacote". O pacote vendido abre uma comanda no caixa e passa a valer quando ela é paga. Na comanda, ao escolher um serviço coberto pelo pacote do cliente, "Usar o pacote" já vem marcado: o serviço sai por R$ 0 e o uso fica registrado, respeitando a quantidade, a vigência e os limites. Receber uma comanda paga com cliente identificado credita o selo e o cashback configurados.

**Camada de dados:** as telas usam `api` de `src/dados/api.js`, que tem duas implementações com a mesma interface:

- **`pnpm dev` e produção:** a API real (`src/dados/apiHttp.js`). O que ainda não migrou cai na versão em memória.
- **Testes do front, ou com `VITE_DADOS=exemplo`:** os dados de exemplo em memória (Barbearia do Zé, 3 barbeiros, 4 serviços, 4 produtos, 8 clientes, caixa do dia com 3 comandas).

As recusas de negócio (horário ocupado, telefone repetido, exclusão em uso) chegam como `ErroDeNegocio` e aparecem no diálogo de negação.

## Kit de UI (`@barbertime/ui`)

**Estrutura e formulários**

| Item                             | Para quê                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DsApp`                          | raiz obrigatória: tema, notificações e diálogos                                                            |
| `DsLayout`                       | cabeçalho com slot `marca`, menu lateral (`itensMenu: [{ titulo, rota, icone? }]`) e conteúdo              |
| `DsPagina`                       | cabeçalho de tela: `titulo`, `sobretitulo`, slot `acoes`                                                   |
| `DsCartao`                       | superfície com `titulo`, conteúdo e slots `acoes` e `cabecalho-acoes`                                      |
| `DsDialogo`                      | `v-model`, `titulo`, `largura` (sm/md/lg/xl), `fechavel` (X no título, dispensa rodapé), slot `acoes`      |
| `DsFormulario`                   | valida tudo e só emite `enviar` se válido; `DsBotao formulario="id"` envia de fora (ex.: ações do diálogo) |
| `DsInput` / `DsSelect`           | `rotulo`, `obrigatorio`, `regras`, `erro`; `tipo` inclui `data` e `hora`; `opcoes: [{ valor, rotulo }]`    |
| `DsTextarea`                     | texto longo com `rotulo`, `maxCaracteres`, `obrigatorio`                                                   |
| `DsInputTelefone` / `DsInputCpf` | máscara e validação; o modelo guarda só dígitos                                                            |
| `DsInputMoeda`                   | valor em reais digitado como centavos; o modelo é número                                                   |

**Ações e exibição**

| Item               | Para quê                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DsBotao`          | `variante` primario/secundario/perigo/fantasma, `tamanho` sm/md/lg                                                                       |
| `DsAcao`           | botão de ação estilo PDV (ícone, título, descrição; primario/secundario/perigo; `compacta` com 52px)                                     |
| `DsAbas`           | abas acessíveis: `v-model`, `abas: [{ valor, rotulo }]`, conteúdo no slot `#<valor>`                                                     |
| `DsEscolha`        | escolha única em botões grandes (ex.: forma de pagamento): `v-model`, `opcoes`, `rotulo`                                                 |
| `DsPassos`         | indicador de etapas (stepper): `v-model` com a etapa atual, `passos: [{ rotulo }]`; etapas concluídas voltam com um toque                |
| `DsCaixaDeSelecao` | caixa de seleção com `rotulo` e `descricao`                                                                                              |
| `DsIcone`          | ícone por nome do catálogo (`agenda`, `caixa`, `clientes`, `whatsapp`...; ver `NOMES_DE_ICONES`)                                         |
| `DsSelo`           | status com palavra: confirmado, pendente, assinante, fila, faltou, neutro                                                                |
| `DsTabela`         | `colunas: [{ campo, titulo, formatar? }]`, `@selecionar`, slot `celula-<campo>`; `semRodape` sem paginação; `compacta` com linhas baixas |
| `DsHorarios`       | escolha de horário: `opcoes: [{ hora, disponivel }]`, `v-model` com a hora                                                               |
| `DsBlocoAgenda`    | bloco da agenda: `cliente`, `servico`, `inicio`, `fim`, `estado`, `clicavel`                                                             |

**Composables**

| Item               | Para quê                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `useDialogo()`     | `confirmar` (sim/não → boolean), `advertir` (Voltar/Continuar → boolean), `negar` (só "Entendi") |
| `useConfirmacao()` | atalho de `useDialogo().confirmar`                                                               |
| `useNotificacao()` | `.sucesso()`, `.erro()`, `.aviso()`, `.info()`                                                   |
| `useTema()`        | aplica o tema claro/escuro (a escolha é preferência, ADR 0006)                                   |

Vitrine em `/componentes` no app, só no modo de desenvolvimento (`pnpm dev`) e fora do menu. Os contratos de comportamento ficam em `libs/ui-contrato`.

## Regras do workspace

- **UI:** telas importam só de `@barbertime/ui` e `@barbertime/ui-utils` (skill `design-system`). O ESLint bloqueia `vuetify` e `@barbertime/ui-vuetify` no app.
- **Multi-tenant:** toda tabela de negócio tem `barbearia_id` e RLS. A API usa o papel `barbertime_app`, sem BYPASSRLS (ADR 0001).
- **Fronteiras:** `scope:front` e `scope:back` não se importam; código comum vai para uma lib `scope:shared`. Libs `type:ui` só dependem de outras `type:ui`.
- **Preferências:** seguem `.claude/rules/central-de-preferencias.md` (ADR 0006).
- **Planejamento:** todo plano vira documento em `docs/planejamentos/` (skill `planejamento-documentado`).
- **Geradores Nx:** sempre com `--js` (e `--bundler=none` para libs), para não reintroduzir TypeScript (ADR 0008).

## Configuração dos agentes de IA

`.claude/`, `.agents/`, `.cursor/`, `.github/`, `.opencode/`, `.codex/` e `.gemini/` trazem skills e instruções (Nx, design system, planejamento) para os assistentes de código.

### Fluxo de trabalho e Graphify (Claude Code)

A ordem obrigatória está em `.claude/rules/fluxo-de-trabalho.md`: grafo → planejamento → skills da área → implementar com testes → verificar → revisar → fechar. Hooks em `.claude/hooks/` a garantem (planejamento 0021):

| Hook                             | O que faz                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `UserPromptSubmit`               | Injeta a ordem de trabalho em todo pedido                                          |
| `PreToolUse` Bash/Grep/Read/Glob | Lembra de consultar o grafo antes de buscar em arquivos                            |
| `PreToolUse` Edit/Write          | **Nega** editar `.vue`/`libs/ui-*` sem a skill `design-system` carregada na sessão |
| `Stop`                           | Atualiza o grafo (`graphify update .`) quando houve mudança de código              |

Instalar o Graphify (uma vez por máquina; extração local, sem LLM):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh     # se ainda não tiver o uv
~/.local/bin/uv tool install graphifyy==0.9.96
~/.local/bin/graphify install                       # skill /graphify no Claude Code
~/.local/bin/graphify extract . --code-only         # gera graphify-out/ (fora do git)
```

Consultas: `graphify query "como o balcão calcula o encaixe"`, `graphify affected "totalDaComanda"`, `graphify path "BalcaoView.vue" "sugerirEncaixe()"`.
