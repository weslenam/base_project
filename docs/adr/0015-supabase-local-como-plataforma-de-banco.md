# ADR 0015: Supabase local como plataforma de banco, migrações e e-mail

- **Status:** Substituído por planejamento 0041 (2026-11-12)
- **Data:** 2026-11-08
- **Relacionado:** ADRs 0001, 0002, 0009 e 0014; planejamento 0025 (sprints S1 e S8)

## Contexto

O ambiente local usa:

- um Postgres e um Mailpit no `docker-compose`;
- o papel da aplicação criado por `docker/postgres/init.sql`;
- migrações em JavaScript com `node-pg-migrate`.

O Weslen decidiu migrar para o Supabase local, por inteiro e em sprints. A produção ainda não está decidida: pode ser o Supabase hospedado ou um Postgres comum.

## Decisão

- **Ambiente local:** o Supabase CLI fornece o banco, as migrações, o e-mail de teste (Mailpit/Inbucket do stack) e o Studio.
  - O CLI fica fixado como devDependency (`supabase` no `package.json`) e sobe com `pnpm supabase start`.
- **Migrações:** em SQL, em `supabase/migrations/`.
  - A primeira é uma baseline do schema atual.
  - As migrações JS de `apps/api/migracoes/` ficam no git como histórico e saem na sprint S8.
- **A API conecta com o papel próprio `barbertime_app`** (sem `BYPASSRLS`), criado numa migração. Nunca conecta como `postgres` nem com a `service_role`.
- **Testes de integração:** num banco `barbertime_teste` do mesmo Postgres, recriado a cada execução com as migrações.
  - O CI, quando existir, usa um Postgres de serviço com as mesmas migrações.
- **Serviços do stack:** os que não forem usados (Storage, Edge Functions, Analytics) ficam desligados no `config.toml`.
- **Redis:** sai na S8. O limite de requisições passa a guardar o estado no Postgres.

## Consequências

- O `docker-compose` (Postgres, Mailpit, Redis) continua até a S8, para servir de volta atrás.
- **Regras para quem escreve migração:** escreve SQL, não JS. Toda tabela de barbearia nasce com RLS e chave estrangeira composta `(barbearia_id, id)`.
- **Recursos exclusivos do Supabase:** são evitados fora do adaptador de identidade (ADR 0016), para que a produção em Postgres comum continue possível.
