# Planejamento 0040: TypeScript em todo o workspace e Kysely no acesso ao banco

- **Status:** Em andamento (etapas 1 e 2 concluídas; próxima: etapa 3)
- **Data:** 2026-11-09
- **Solicitado por:** Weslen
- **Relacionado:** ADR 0008 (JS puro, que será substituído), ADR 0009 (SQL à mão, sem ORM, a revisar), ADRs 0001, 0014 e 0017; planejamento 0027 (a fatia 2B do financeiro fica pausada)
- **Commits:** ainda não commitado

## Solicitação de origem

> porque nao estamos usando algum ORM? e estamos usando sql "bruto"

> se quisermos implementar um ORM qual é o impacto é possivel, a estratégia com relacao as empresas podemos assumir que o "id_empresa" circula dentro das tabelas? sugira outra estrategia

> tambem vou querer usar typescript temos ganho?

> mas eu acho q vale converter agora para typescript + orm

- **Quando:** 2026-11-09 · **Origem:** Conversa com o assistente (entrevista `grill-me`)
- **Esclarecimentos:**
  - Financeiro → **fechar a 2A, pausar a 2B**. A 2A entrou na `main` pelo PR #31, e a 2B volta depois, já em TypeScript.
  - Ferramenta de banco → **Kysely** (query builder tipado, com os tipos gerados do banco).
  - Alcance → **tudo, em etapas**: API, domínio, design system, os dois apps e os testes, sem funcionalidades novas até terminar.
  - Rigor → **`strict` desde o início** em todo código convertido.
  - Estratégia de empresas → **mantida**: coluna `barbearia_id` + RLS + chaves compostas (ADR 0001). Banco ou schema por barbearia foram analisados e descartados para agora.

## Objetivo

Converter o workspace (cerca de 190 arquivos e 26 mil linhas, sem contar os testes) para TypeScript `strict` e trocar o SQL escrito à mão por consultas Kysely tipadas, sem mudar nenhum comportamento: as mesmas rotas, telas, regras e o mesmo isolamento por barbearia.

**Fora do escopo:**

- funcionalidades novas, incluindo a fatia 2B do financeiro;
- mudar o modelo de dados ou as migrações, que continuam em SQL no `supabase/migrations`;
- trocar Fastify, Vue, Vuetify ou o Supabase;
- mudar a estratégia de multiempresa.

## Decisões

1. **Kysely sobre a transação da barbearia.** `comBarbearia` passa a abrir `db.transaction()`, fazer o `set_config('app.barbearia_id', …)` e entregar o `trx` aos serviços. Toda consulta da requisição usa esse `trx`, na mesma conexão. A RLS segue sendo a proteção principal, e um teste garante que consulta fora do `trx` não enxerga dados.
2. **Tipos do banco gerados** com `kysely-codegen`, a partir do schema `app` do Supabase local, num arquivo versionado. Um comando (`pnpm banco:tipos`) os gera de novo depois de cada migração, e a verificação falha se estiverem desatualizados.
3. **Continua em SQL (`sql\`\`` do Kysely)** só o que o builder não expressa bem: CTEs com `update` (sessão), funções do schema (`app.resumo_barbearias`) e casos pontuais. Cada uso fica comentado.
4. **Conversão por etapas, de baixo para cima.** Cada etapa termina com `pnpm verificar:tudo` e layout verdes, um commit e um PR. Os testes continuam passando a cada etapa e são a rede de segurança.
5. **Os contratos da API viram tipos compartilhados** numa lib nova `libs/contratos` (respostas e corpos das rotas), usados pela API e pela camada de dados dos apps.
6. **Novo ADR 0022, "TypeScript strict e Kysely"**, substituindo o ADR 0008 e a parte "sem ORM" do ADR 0009. A skill `design-system` (Vue em JS), a `mudancas-cirurgicas`, o CLAUDE.md, os agentes e as regras são atualizados.

## Etapas (uma por PR)

- [x] 1. **Base:** `tsconfig.base.json` com `strict`, targets `typecheck` no Nx (`tsc --noEmit` e `vue-tsc`) dentro do `pnpm verificar`, ESLint com `typescript-eslint`, Vite e Vitest com TS. O `allowJs` fica ligado só enquanto houver JS. ADR 0022 e atualização das skills e regras.
- [x] 2. **`libs/dominio`** em TS: tipos das entidades (comanda, conta, assinatura etc.) e regras puras.
- [ ] 3. **`libs/ui-utils` e `libs/ui-tokens`** em TS.
- [ ] 4. **`libs/contratos`:** tipos das respostas e dos corpos da API.
- [ ] 5. **API, infraestrutura:** Kysely, `comBarbearia` e `emTransacao` com `trx`, tipos gerados do banco, plugins do Fastify tipados (sessão, contexto, `exigir`) e teste de isolamento.
- [ ] 6. **API, serviços e rotas** convertidos para TS + Kysely, módulo a módulo: cadastros e clientes; agenda e balcão; caixa, fidelidade e pacotes; estoque e financeiro; plataforma e autenticação. Os testes de integração viram TS.
- [ ] 7. **`libs/ui-vuetify` e `libs/ui-contrato`:** componentes `Ds*` com `<script setup lang="ts">` e props tipadas.
- [ ] 8. **`apps/business-center`** (pequeno: 15 arquivos).
- [ ] 9. **`apps/barbertime`:** camada de dados tipada pelos contratos e telas com `lang="ts"`, por pasta.
- [ ] 10. **Fechamento:** desligar `allowJs`, remover o `jsconfig.json`, rodar `/code-review` e `security-review` gerais e atualizar os índices.

## Critérios de pronto

- Nenhum `.js` de código-fonte; `strict` sem `any` implícito. `// @ts-expect-error` só com comentário de motivo.
- `pnpm verificar:tudo` (com o `typecheck`) e `pnpm verificar:layout` verdes, com o mesmo número de testes ou mais.
- Nenhuma consulta com SQL concatenado: Kysely ou `sql` com parâmetros.
- O teste de isolamento por barbearia passa com o Kysely, e a revisão de segurança não encontra nada.
- Comportamento idêntico: os testes atuais, convertidos, passam sem mudar o que verificam.

## Riscos e pendências

- **Tamanho:** é o maior trabalho até aqui, com estimativa de 3 a 6 semanas de trabalho em etapas. Durante esse tempo não entram funcionalidades novas.
- **Isolamento:** um serviço que use a conexão errada fura a RLS. Isso é mitigado pela decisão 1, pelo teste de isolamento e pela revisão de segurança em cada PR.
- **Tipos do `pg`:** hoje `bigint`, `numeric` e `date` são convertidos (Number e texto `AAAA-MM-DD`). Os tipos gerados precisam refletir isso; o `kysely-codegen` tem opção de sobrescrever tipos.
- **Testes de tela com `montarApp`:** podem precisar de ajuste na montagem com TS.
- **Grafo (graphify):** precisa ser regerado (`--force`) depois de cada etapa grande.

## Registro de mudanças

- 2026-11-09: criado depois da entrevista (4 perguntas). Antes, a fatia 2A do financeiro foi fechada (PR #31).
- 2026-11-09: plano aprovado ("sim pode fazer"); começa a etapa 1.
- 2026-11-09: **etapa 1 concluída.**
  - `tsconfig.base.json` com `strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions` e `allowJs` (sem `checkJs`); um `tsconfig.json` por projeto. Sem `baseUrl` (deprecado no TypeScript 6): o `paths` é relativo.
  - Target `typecheck` em cada um dos 9 projetos (`tsc` ou `vue-tsc`), dentro do `pnpm verificar` e do `verificar:tudo`.
  - ESLint com `flat/typescript` do Nx e o parser de TypeScript nos `.vue`. Vitest e integração aceitam `*.spec.ts`.
  - Dependências: `vue-tsc` e `kysely-codegen` (desenvolvimento) e `kysely` na API.
  - ADR 0022 aceito; ADR 0008 substituído; ADR 0009 com a parte do ORM substituída. Skills `design-system` e `mudancas-cirurgicas` e agente `implementador` atualizados.
  - Verificado: `pnpm verificar` (28 tarefas) e integração (146).
- 2026-11-10: **etapa 2 concluída.** `libs/dominio` em TypeScript strict: 13 arquivos de regra e 9 de teste (`git mv`, histórico preservado), sem erro de tipo.
  - Tipos exportados pelo `index.ts`: `ItemComanda`, `Comanda`, `MovimentoDeCaixa`, `Permissao`, `Papel`, `QuemAge`, `ConfigBarbearia`, `AtendimentoBalcao`, `SituacaoDoBarbeiro`, `ConfigFidelidade`, `MovimentoFidelidade`, `SaldoFidelidade`, `Pacote`, `Assinatura`, `ProdutoEstoque`, `Conta` e outros.
  - Nenhuma regra mudou: os 124 testes passaram sem mudar o que verificam (só tipos e `!` em resultados de `find`).
  - Ajustes de tipo que refletem o uso real: no item de comanda, `tipo` e `preco` são opcionais (sem tipo conta como serviço); `podeUsarPacote` devolve `{ ok, motivo? }`.
  - Comprovado: a API (Node 22, sem compilar) importa o domínio em `.ts`; os apps compilam (Vite); integração (146) e layout (89) verdes.
  - Testes podem usar `!` (regra liberada só em `*.spec.ts`), e os `tsconfig` ganharam os tipos globais do Vitest.
