// Fundação multi-tenant (ADRs 0001, 0009, 0010, 0011): barbearias, usuários, sessões,
// papéis, vínculos e módulos. Tabelas da barbearia com RLS habilitado e FORÇADO.

export const up = (pgm) => {
  pgm.sql(`
    create table barbearias (
      id bigserial primary key,
      nome text not null check (length(trim(nome)) > 0),
      slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
      criada_em timestamptz not null default now()
    );

    create table usuarios (
      id bigserial primary key,
      nome text not null check (length(trim(nome)) > 0),
      email text not null,
      senha_hash text not null,
      criado_em timestamptz not null default now()
    );
    create unique index usuarios_email_unico on usuarios (lower(email));

    create table sessoes (
      id_hash text primary key,
      usuario_id bigint not null references usuarios (id) on delete cascade,
      barbearia_id bigint references barbearias (id) on delete cascade,
      expira_em timestamptz not null,
      criada_em timestamptz not null default now()
    );
    create index sessoes_usuario on sessoes (usuario_id);

    create table papeis (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      chave text,
      nome text not null check (length(trim(nome)) > 0),
      protegido boolean not null default false,
      permissoes text[] not null default '{}',
      unique (barbearia_id, nome)
    );
    create index papeis_barbearia on papeis (barbearia_id);

    create table vinculos (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      usuario_id bigint not null references usuarios (id) on delete cascade,
      papel_id bigint not null references papeis (id),
      ativo boolean not null default true,
      criado_em timestamptz not null default now(),
      unique (barbearia_id, usuario_id)
    );
    create index vinculos_barbearia on vinculos (barbearia_id);

    create table barbearia_modulos (
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      modulo text not null,
      estado text not null check (estado in ('inativo', 'solicitado', 'ativo')),
      atualizado_em timestamptz not null default now(),
      primary key (barbearia_id, modulo)
    );
  `);

  // RLS: só a barbearia definida na transação (set_config app.barbearia_id).
  for (const tabela of ['papeis', 'vinculos', 'barbearia_modulos']) {
    pgm.sql(`
      alter table ${tabela} enable row level security;
      alter table ${tabela} force row level security;
      create policy ${tabela}_da_barbearia on ${tabela}
        using (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint)
        with check (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint);
    `);
  }

  // Login precisa listar as barbearias do usuário sem barbearia definida ainda.
  // Função SECURITY DEFINER, restrita a esse uso.
  pgm.sql(`
    create function barbearias_do_usuario(p_usuario bigint)
    returns table (barbearia_id bigint, nome text, slug text)
    language sql stable security definer set search_path = public as $$
      select b.id, b.nome, b.slug
        from vinculos v join barbearias b on b.id = v.barbearia_id
       where v.usuario_id = p_usuario and v.ativo
       order by b.nome
    $$;
    revoke all on function barbearias_do_usuario(bigint) from public;
  `);

  // Acesso do papel da aplicação (criado em docker/postgres/init.sql), se existir.
  pgm.sql(`
    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'barbertime_app') then
        grant select, insert, update, delete on all tables in schema public to barbertime_app;
        grant usage, select on all sequences in schema public to barbertime_app;
        grant execute on function barbearias_do_usuario(bigint) to barbertime_app;
      end if;
    end $$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    drop function if exists barbearias_do_usuario(bigint);
    drop table if exists barbearia_modulos, vinculos, papeis, sessoes, usuarios, barbearias cascade;
  `);
};
