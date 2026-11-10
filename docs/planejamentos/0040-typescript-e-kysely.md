# Planejamento 0040: TypeScript em todo o workspace e Kysely no acesso ao banco

- **Status:** Em andamento (etapas 1 a 3 e 5 a 8 concluídas; etapa 9 em andamento: 9A feita, faltam as telas)
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
> divida então a conversao 5 e 6 em dois agentes (2026-11-10)

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
- [x] 3. **`libs/ui-utils` e `libs/ui-tokens`** em TS.
- [ ] 4. **`libs/contratos`:** tipos das respostas e dos corpos da API.
- [x] 5. **API, infraestrutura:** Kysely, `comBarbearia` e `emTransacao` com `trx`, tipos gerados do banco, plugins do Fastify tipados (sessão, contexto, `exigir`) e teste de isolamento.
- [x] 6. **API, serviços e rotas** convertidos para TS + Kysely, módulo a módulo: cadastros e clientes; agenda e balcão; caixa, fidelidade e pacotes; estoque e financeiro; plataforma e autenticação. Os testes de integração viram TS.
- [x] 7. **`libs/ui-vuetify` e `libs/ui-contrato`:** componentes `Ds*` com `<script setup lang="ts">` e props tipadas.
- [x] 8. **`apps/business-center`** (pequeno: 15 arquivos).
- [ ] 9. **`apps/barbertime`:** camada de dados tipada pelos contratos e telas com `lang="ts"`, por pasta.
- [ ] 10. **Fechamento:** desligar `allowJs`, remover o `jsconfig.json`, rodar `/code-review` e `security-review` gerais e atualizar os índices.

## Guia da etapa 6 (para os agentes)

Base pronta na etapa 5: `apps/api/src/infra/banco.ts` (Kysely na transação), `banco-tipos.ts` (gerado), `app/tipos-fastify.ts` (o que o Fastify tem pendurado), os arquivos compartilhados já em `.ts` e o teste de isolamento `integracao/kysely.spec.ts`. **Exemplo de referência:** `servicos/agenda.ts`.

**Como converter um arquivo:**

1. `git mv x.js x.ts` e troque, **em todos os importadores**, `'./x.js'` por `'./x.ts'`. O Node exige a extensão certa.
2. Tipos explícitos em tudo o que é exportado (parâmetros e retornos), com `strict` e só sintaxe apagável (sem `enum` nem `namespace`). Use os tipos do `@barbertime/dominio`.
3. **SQL → Kysely:**
   - Use `c.db` (o `c` é a `Conexao` que o `fastify.naBarbearia` ou o `emTransacao` entrega). As colunas vêm em camelCase (`CamelCasePlugin`), então os `as "camelCase"` somem.
   - **Nunca** crie outro Kysely, nunca use `c.db.transaction()` e nunca guarde o `c.db` para usar fora do callback. O isolamento entre barbearias depende disso.
   - `for update` → `.forUpdate()`. CTE com `update`, `union` ou funções do schema (`app.*`): use o `sql` do Kysely, sempre com parâmetros (nada de concatenar texto vindo da requisição), e explique o motivo num comentário.
   - Inserção: o `barbeariaId` sai do `req.contexto` (nunca do corpo).
4. **Rotas:** `export default async function (fastify: FastifyInstance)`. Tipe `req.body`, `req.params` e `req.query` pelo genérico da rota (`fastify.post<{ Body: …; Params: … }>`). Mantenha os schemas do ADR 0014.
5. **Contratos (etapa 4):** o formato das respostas que o front consome vira tipo exportado num arquivo `contratos.ts` do módulo (ex.: `servicos/caixa.contratos.ts`). A `libs/contratos` junta tudo na etapa 9.
6. **Testes de integração do módulo:** `git mv *.spec.js *.spec.ts`, tipando o mínimo. O `Resposta.corpo` do `navegador` é `any` de propósito.
7. **Nada de `?? ''` ou `!` só para calar o tipo** em código de segurança ou de dinheiro: trate o caso vazio de propósito (issue #33).
8. **Comportamento idêntico:** os testes existentes passam sem mudar o que verificam. Diferença de comportamento encontrada é bug: abra uma issue (seção "Bugs e branches") e não a corrija de passagem.
9. Ao terminar: `pnpm verificar:tudo` verde, `/code-review` e `security-review` no diff, depois commit, push e PR.

**Divisão dos arquivos** (sem arquivos em comum; o `app.ts` tem um bloco de imports por agente, separado por linhas):

| Agente A, operação | Agente B, cadastros, acesso e plataforma |
|---|---|
| `servicos/`: `caixa`, `estoque`, `fidelidade`, `pacotes`, `financeiro` | `servicos/`: `barbearias`, `operadores` |
| `rotas/`: `agenda`, `balcao`, `caixa`, `estoque`, `fidelidade`, `pacotes`, `financeiro` | `rotas/`: `autenticacao`, `barbearia`, `cadastros`, `clientes`, `modulos`, `pagamentos`, `papeis`, `plataforma`, `publico`, `saude`, `senha`, `usuarios` |
| `integracao/`: `agendaBarbeiro`, `balcao`, `balcaoBarbeiro`, `correcoes`, `estoque`, `fidelidade`, `financeiro`, `pacotes` | `identidade/*`, `pagamentos/*`, `app/plugins/*`, `scripts/*` |
| | `integracao/`: `administracao`, `configuracoes`, `isolamento`, `negocio`, `plataforma`, `seguranca` |

Arquivos de fora desta lista (`infra/*`, `app/app.ts`, `app/esquemas.ts`, `seguranca/*`, `servicos/agenda.ts`, `integracao/apoio.ts`) já estão convertidos. Cada agente só mexe no próprio bloco de imports do `app.ts`.

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
- **Servidor de desenvolvimento:** quando um pacote troca o `index.js` por `index.ts`, o Vite em execução guarda a resolução antiga e as telas quebram. Reiniciar o `pnpm dev` resolve (visto na etapa 3).
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
- 2026-11-10: **etapa 3 concluída.** `libs/ui-utils` (formatação e máscaras) e `libs/ui-tokens` em TS. O gerador de tokens virou `scripts/gerar-tokens.ts` (roda direto no Node, com os tipos do `tokens.json`) e passou a gerar `src/tokens.ts`; o teste confere que o arquivo gerado está atualizado. `pnpm verificar` e layout (89) verdes, depois de reiniciar o `pnpm dev`.
- 2026-11-10: etapas 1 a 3 juntas na `main` pelo PR #32. Combinado: cada etapa vai para push, PR e merge logo que fica verde. A etapa 4 (contratos) entra junto com a conversão da API, criando cada contrato com a rota correspondente. Divisão: a etapa 5 é feita primeiro, aqui, porque é a base comum. Depois do merge dela, **dois agentes em paralelo** (cada um numa cópia isolada) dividem os módulos da etapa 6 e abrem um PR cada. Resposta à pergunta "como dividir": **"5 antes; 6 em dois agentes"**.
- 2026-11-10: **etapa 5 concluída.**
  - **Tipos do banco:** `banco-tipos.ts` gerado pelo `kysely-codegen` (camelCase, `bigint` e `numeric` como número, `date` como texto). Comandos `pnpm banco:tipos` e `api:banco-tipos-conferir`, este último dentro do `verificar:tudo`. O arquivo gerado não passa pelo Prettier (a conferência compara com a saída do gerador).
  - **`banco.ts`:** a transação entrega `c.query` (SQL do driver) e `c.db` (Kysely na mesma conexão). O `c.db` recusa consultas depois que a transação acaba.
  - **`tipos-fastify.ts`:** `naBarbearia`, `exigir`, `req.contexto` e outros, tipados.
  - **Desvio do plano:** os arquivos compartilhados entraram nesta etapa (`infra/*`, `app.ts`, `esquemas`, `seguranca/*`, `servicos/agenda`, `main`, utilitários dos testes). Se ficassem com um dos agentes, cada renomeação mexeria nos arquivos do outro. O `servicos/agenda.ts` já usa o Kysely e serve de exemplo.
  - **Teste de isolamento** (`kysely.spec.ts`): só a barbearia da transação; RLS recusa gravar em outra; `db` guardado não roda depois; driver e Kysely na mesma transação.
  - **Ajustes de tipo sem mudar comportamento:** a `@fastify/rate-limit` declara `isExceeded` só quando o pedido não foi liberado, e a opção `cache` fica fora dos tipos de `createRateLimit`.
  - **Verificado:** `verificar:tudo` e layout (89) verdes, com o `pnpm dev` reiniciado.
  - **Revisão (`/code-review`) da etapa 5:**
    - corrigidos, com teste de regressão:
      - #33 (alta): `conferirSenha` aceitava qualquer senha com hash truncado, por causa de um `?? ''` posto na conversão. Agora hash ou sal vazio nunca confere;
      - #34: `engines` passa a `>=22.18`, porque o Node roda `.ts` direto;
      - #35: rollback que falha mantém o erro original e descarta a conexão.
    - endurecidos:
      - `c.db.transaction()` e `startTransaction()` lançam erro;
      - o Kysely só é montado quando a rota usa `c.db`;
      - nomes de limite tipados (`NomeDoLimite`);
      - `confirmadoEm` aceita `Date` no domínio.
    - pendências:
      - a conferência dos tipos do banco usa o banco de desenvolvimento, não um recém-migrado: se o banco local estiver atrasado, ela erra;
      - `ocupadosDoDia` mantém o mesmo filtro de antes (só `inicio` não nulo);
      - o parâmetro `ignorarId` não tem quem o use (já era assim).
  - **Lição:** um `?? ''` posto só para calar o tipo pode mudar o comportamento. Em código de segurança, trate o caso vazio explicitamente. Isso entra no guia da etapa 6.
- 2026-11-10 — Etapa 6 concluída por dois agentes em paralelo, cada um na sua worktree e no seu banco de testes (`barbertime_teste_a` e `barbertime_teste_b`). O limite de uso interrompeu os dois no meio, e eles retomaram de onde pararam.
  - **6B (PR #38): cadastros, acesso e plataforma.**
    - Kysely na transação da barbearia; as tabelas globais seguem no pool, com o driver pg tipado.
    - Da revisão: `sameSite` literal no cookie do operador, `Object.hasOwn` na escolha da identidade, `typeof` em `validarNovoUsuario` e uma leitura a menos em `salvarProduto`.
  - **6A: operação** (agenda, balcão, caixa, estoque, fidelidade, pacotes e financeiro).
    - Contratos em `servicos/*.contratos.ts`.
    - `servicos/atendimentos.ts` com o SELECT da agenda e um filtro parametrizado.
    - O `transitar` do balcão deixou de concatenar texto no SET.
    - O `semear.ts` passou a importar o `estoque.ts`.
  - **Verificação dos dois:** typecheck e lint sem erros, 25 testes unitários e 150 de integração. Revisões de segurança sem achados.
  - **Bugs antigos achados na conversão,** todos mantidos e virados issue: #39 (horários sem data), #40 (`canal` vindo do corpo), #41 (`itens: null` dá 500), #42 (PUT com id 0 cria registro), #43 (id ausente vira NaN e dá 500) e #44 (login sem senha confere "undefined").
  - **Pendências de qualidade (da revisão, para a etapa 10):**
    - consultas em tabelas globais ainda sem os tipos gerados (um Kysely no pool resolveria);
    - contratos de módulos pequenos dentro do próprio arquivo de rota;
    - `obterAtendimento` duplica o `buscarAtendimento` (tipar `LinhaDeAtendimento`);
    - helpers repetidos: `codigoDoErro`, `inteiroOuNulo`, comparação sem caixa e `ComId`/`na` nas rotas;
    - contagem de futuros repetida em clientes e cadastros;
    - `fecharCaixa` recalcula o resumo;
    - cast em `doDia` do balcão (tornar `situacaoDosBarbeiros` genérico).
- 2026-11-10 — Bug #39 corrigido antes da etapa 7 (PR #46): horários livres sem data respondem 400.
- 2026-11-10 — Etapa 7 concluída.
  - **`ui-vuetify`:**
    - todos os `Ds*` com `<script setup lang="ts">`;
    - props em runtime com `PropType` (os validadores continuam valendo) e eventos tipados;
    - o `DsTabela` ficou genérico (`generic="L extends object"`), para as telas tipadas das etapas 8 e 9;
    - tipos públicos em `src/tipos.ts` (`ColunaDaTabela`, `OpcaoDeEscolha`, `Passo`, `ItemDoMenu`...) e `NomeDoIcone`, exportados pelo `index.ts`;
    - `abrirDialogo` com sobrecargas, sem cast.
  - **`ui-contrato`:**
    - testes em `.ts`, com o tipo `Montar`;
    - os tipos `ApiDeDialogo`, `ApiDeNotificacao` e `ApiDeTema` são o contrato dos composables, e a implementação os confere com `satisfies`;
    - `clicarBotao` e `exigir` fazem o teste falhar dizendo o que não achou.
  - **Fora do plano:**
    - o pacote `qrcode` não traz tipos: uma declaração mínima fica em `src/qrcode.d.ts`, referenciada pelo `index.ts`, e não entra dependência nova;
    - o `DsFormulario` sem o `VForm` montado lança erro explícito (antes era um TypeError).
  - Skill `design-system` atualizada (`index.ts`).
- 2026-11-10 — Etapa 8 concluída.
  - **`apps/business-center`:**
    - telas com `lang="ts"`;
    - `http<T>` tipado;
    - `RouteMeta` declarado (publica e menu);
    - testes em `.ts`.
  - **Antecipado da etapa 9:** a `libs/contratos` (`scope:shared`) nasce aqui, porque a regra de fronteiras proíbe o front de importar da API.
    - Por ora ela tem só os contratos da plataforma, movidos da API (`rotas/plataforma.contratos.ts`), e o tipo `EmJson<T>`.
    - O `EmJson<T>` faz o `Date` da API virar texto, como chega pelo JSON.
    - A API e o business-center importam os contratos de `@barbertime/contratos`.
    - Na etapa 9, os outros contratos (`servicos/*.contratos.ts` e os das rotas) entram nessa lib.
  - **Fora do plano:**
    - selo de módulo com estado desconhecido aparece neutro, em vez de quebrar o painel;
    - ação de módulo incompleta dá erro, em vez de um falso sucesso.
  - **Visto nas capturas, já era assim:** na lista do Business Center, o nome e o e-mail do Dono aparecem colados.
- 2026-11-10 — Etapa 9A (base do app `barbertime`): "pode executar a etapa 9".
  - **Contratos:** todos na `libs/contratos`, com um arquivo por módulo.
    - Os `*.contratos.ts` da API e os tipos exportados das rotas foram movidos para lá.
    - A API importa de `@barbertime/contratos`.
    - Nova regra de fronteira: `scope:shared` só depende de `scope:shared`.
  - **Camada de dados:**
    - interface `Api` em `src/dados/tipos.ts`, com as respostas tipadas pelos contratos (`EmJson`);
    - a `apiHttp` e a `api.ts` em memória a cumprem;
    - entradas de formulário ficam com o tipo `Corpo` aberto até a tela de cada uma virar TS; já têm tipo próprio `NovoAgendamento`, `NovoBloqueio`, a configuração da fidelidade e a venda e renovação de pacote.
  - **Versão em memória** (Weslen: "Tipar como está"):
    - as tabelas estão tipadas em `src/dados/banco.ts`;
    - as respostas passaram a ter o formato do contrato (status, origem e canal do atendimento; `emPausa` do barbeiro; `pagaAs` e `atendimentoId` da comanda; `emUso` da categoria);
    - `barbearia.obterPorSlug` (sem uso) saiu, e `clientes.reconhecer` virou função interna, usada pela página pública;
    - o agendamento confirmado conta como "chegou", porque a memória não tem balcão e o "Marcar atendido" continua como antes.
  - **Sessão, rotas e testes:** `RouteMeta` declarado, `useAcao` genérico e apoio dos testes tipado.
  - **Telas:** continuam em JS, convertidas por pasta nas próximas partes (9B em diante).
  - **Balcão:** as respostas ficam `unknown` até a tela do balcão ganhar o contrato dela.
