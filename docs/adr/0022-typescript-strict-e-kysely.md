# ADR 0022: TypeScript strict e Kysely no acesso ao banco

- **Status:** Aceito
- **Data:** 2026-11-09
- **Relacionado:**
  - substitui o ADR 0008 (JavaScript puro) e a parte "SQL à mão, sem ORM" do ADR 0009;
  - mantém os ADRs 0001 (multiempresa), 0014 (proteção da API) e 0017 (schema `app`);
  - [planejamento 0040](../planejamentos/0040-typescript-e-kysely.md).

## Contexto

O workspace nasceu em JavaScript puro (ADR 0008), com SQL escrito à mão no driver `pg` (ADR 0009). Com cerca de 26 mil linhas, dois problemas pesaram:

- **Erros de forma só aparecem em teste ou em produção:** campo com nome errado, coluna renomeada numa migração ou formato de resposta da API diferente do que a tela espera.
- **SQL repetido:** os `select ... as "camelCase"` e o mapeamento das linhas se repetem nas cerca de 320 consultas.

O isolamento por barbearia depende de RLS com `set_config('app.barbearia_id', …)` dentro da transação da requisição. Qualquer ferramenta nova precisa preservar isso.

## Decisão

- **TypeScript com `strict` em todo o workspace:** API, domínio, design system, os dois apps e os testes. A conversão é feita em etapas (planejamento 0040), e o `allowJs` fica ligado só durante ela.
- **Só sintaxe apagável (`erasableSyntaxOnly`):** sem `enum`, `namespace` e propriedades de parâmetro. A API roda o `.ts` direto no Node 22, que remove os tipos sem compilar, e os imports usam a extensão `.ts`.
- **Vue com `<script setup lang="ts">`**, verificado pelo `vue-tsc`. Os componentes `Ds*` têm props tipadas, e o contrato continua em português (skill `design-system`).
- **Kysely como query builder tipado.** Não é ORM: monta o SQL sem esconder conexão nem transação.
  - `comBarbearia` abre `db.transaction()`, faz o `set_config` e entrega o `trx`. Toda consulta da requisição usa esse `trx`, na mesma conexão.
  - Os tipos das tabelas são gerados do banco (`kysely-codegen`), versionados e conferidos na verificação.
  - O SQL literal (`sql` do Kysely, sempre com parâmetros) fica para CTEs com `update`, funções do schema e casos pontuais, cada um comentado.
- **Contratos da API compartilhados** numa lib `libs/contratos`, usada pela API e pelos apps.
- **`typecheck` faz parte do `pnpm verificar`** (`tsc` nos projetos JS/TS e `vue-tsc` nos projetos com Vue).
- **As migrações continuam em SQL** (`supabase/migrations`).

## Alternativas consideradas

- **Prisma:** encaixa mal com RLS e `set_config` por requisição, porque a transação interativa é limitada. Descartado.
- **Drizzle:** viável, mas o schema descrito em código duplicaria as migrações em SQL. Kysely gera os tipos do banco real.
- **Continuar em JS com JSDoc:** ganho menor e sem tipos vindos do banco.

## Consequências

- Durante a conversão não entram funcionalidades novas, e a fatia 2B do financeiro fica pausada.
- Toda consulta passa pelo `trx` da requisição. Uma consulta pelo `db` global numa rota da barbearia é falha de isolamento. Um teste de integração protege isso, e a revisão de segurança confere.
- Depois de cada migração, rodar `pnpm banco:tipos`.
- A skill `design-system`, a `mudancas-cirurgicas`, os agentes e as regras passam a pedir TypeScript.
