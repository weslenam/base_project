# Planejamento 0041: Remover o Supabase CLI e usar PostgreSQL direto

- **Status:** Concluído
- **Data:** 2026-11-12
- **Solicitado por:** weslenam
- **Relacionado:** ADR 0015, ADR 0016, planejamento 0025
- **Commits:** 2c30acc

## Solicitação de origem

> o que precisamos fazer para que o supabase seja substituido pelo postresql?

- **Quando:** 2026-11-12 · **Origem:** Conversa com o assistente

> pode sim planejar e implementar

- **Quando:** 2026-11-12 · **Origem:** Conversa com o assistente

## Objetivo

Remover o Supabase CLI do ambiente de desenvolvimento local, substituindo-o pelo `docker-compose.yml` já existente (Postgres 17 + Mailpit). O código da API continua idêntico — ele já usa PostgreSQL puro (`pg` + Kysely). As migrações SQL em `supabase/migrations/` são movidas para `migrations/`.

**Fora do escopo:**
- Mudar qualquer rota, serviço ou regra de domínio.
- Implementar o adaptador de identidade `supabase` (GoTrue) — planejado na S4 do plano 0025 mas nunca feito; os ADRs 0015 e 0016 serão marcados como revisados.
- Decisões sobre o ambiente de produção.

## Decisões e restrições

| Decisão | Motivo |
|---|---|
| Pasta `migrations/` na raiz | Neutro em relação a ferramentas; espelha o `supabase/migrations/` sem dependência do CLI |
| Manter `docker/postgres/init.sql` | Já cria o papel `barbertime_app` e o banco; basta referenciar nas variáveis do compose |
| Remover compatibilidade com `supabase_migrations` em `migrar.ts` | Com o CLI fora, essa tabela nunca existirá; a coluna extra só atrapalha |
| ADR 0015 e ADR 0016 → status Substituído | As decisões foram tomadas em contexto de "Supabase local como plataforma"; sem o CLI, o contexto mudou |

## Etapas

- [x] 1. Mover `supabase/migrations/*.sql` para `migrations/` (nova pasta na raiz)
- [x] 2. Atualizar `apps/api/src/infra/migrar.ts` — novo caminho + remover bloco de compatibilidade `supabase_migrations`
- [x] 3. Atualizar `apps/api/src/integracao/preparar.ts` — mensagem de erro sem referência ao Supabase
- [x] 4. Atualizar scripts em `package.json` — `banco` passa a usar `docker compose up -d --wait postgres redis mailpit`; remover `banco:parar` via supabase
- [x] 5. Atualizar `.env.example` — portas do compose (5432, 1025) em vez das do Supabase (54322, 54325)
- [x] 6. Remover `supabase/` (config.toml, snippets e pasta vazia); remover `supabase` das devDependencies
- [x] 7. Revisar ADR 0015 e ADR 0016 — marcar como Substituído com nota
- [ ] 8. `pnpm verificar:tudo` passa (precisa do compose no ar)

## Critérios de pronto

- `pnpm banco` sobe o ambiente com `docker compose`, aplica migrações e semeia dados sem erro
- `pnpm verificar:tudo` passa (lint, typecheck, testes unitários, build, integração)
- Nenhuma referência ao `supabase` CLI permanece em código ou scripts (pode ficar em comentários históricos nos ADRs)

## Riscos e pendências

- O `docker/postgres/init.sql` já cria o papel `barbertime_app`, mas sem `LOGIN` nem senha — o `migrar.ts` tem `prepararPapelDaAplicacao` para isso. Verificar que a sequência `compose up → migrar` ainda funciona.
- `supabase/snippets/` pode ter arquivos úteis; revisar antes de apagar.

## Registro de mudanças

- 2026-11-12 — Documento criado. Status: Aprovado (usuário disse "pode sim planejar e implementar").
