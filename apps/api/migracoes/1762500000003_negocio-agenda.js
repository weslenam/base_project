// Planejamento 0019 (parte 1): serviços, produtos, barbeiros, clientes e agenda
// no banco, com RLS forçado por barbearia; token da página pública (ADR 0013).

const TABELAS = [
  'servicos',
  'produtos',
  'barbeiros',
  'clientes',
  'agendamentos',
];

export const up = (pgm) => {
  pgm.sql(`
    alter table barbearias add column token_publico text not null
      default replace(gen_random_uuid()::text, '-', '');

    create table servicos (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      nome text not null check (length(trim(nome)) > 0),
      duracao int not null check (duracao > 0),
      preco numeric(10, 2) not null check (preco >= 0),
      excluido_em timestamptz
    );
    create unique index servicos_nome_unico on servicos (barbearia_id, lower(nome)) where excluido_em is null;

    create table produtos (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      nome text not null check (length(trim(nome)) > 0),
      preco numeric(10, 2) not null check (preco > 0),
      comissao numeric(5, 2) not null default 0 check (comissao between 0 and 100),
      excluido_em timestamptz
    );
    create unique index produtos_nome_unico on produtos (barbearia_id, lower(nome)) where excluido_em is null;

    create table barbeiros (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      usuario_id bigint references usuarios (id) on delete set null,
      nome text not null check (length(trim(nome)) > 0),
      inicio text not null check (inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
      fim text not null check (fim ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
      comissao numeric(5, 2) not null default 0 check (comissao between 0 and 100),
      excluido_em timestamptz,
      check (inicio < fim)
    );

    create table clientes (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      nome text not null check (length(trim(nome)) > 0),
      telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
      cpf text,
      observacoes text not null default '',
      criado_em timestamptz not null default now(),
      unique (barbearia_id, telefone)
    );

    create table agendamentos (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      data date not null,
      inicio text not null,
      fim text not null,
      barbeiro_id bigint not null references barbeiros (id),
      servico_id bigint references servicos (id),
      cliente_id bigint references clientes (id) on delete cascade,
      estado text not null check (estado in ('pendente', 'confirmado', 'atendido', 'faltou', 'cancelado', 'bloqueado')),
      motivo text,
      origem text not null default 'balcao' check (origem in ('balcao', 'publico')),
      criado_em timestamptz not null default now(),
      check (inicio < fim)
    );
    create index agendamentos_dia on agendamentos (barbearia_id, data, barbeiro_id);
    create index agendamentos_cliente on agendamentos (cliente_id);
  `);

  for (const tabela of TABELAS) {
    pgm.sql(`
      create index ${tabela}_barbearia on ${tabela} (barbearia_id);
      alter table ${tabela} enable row level security;
      alter table ${tabela} force row level security;
      create policy ${tabela}_da_barbearia on ${tabela}
        using (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint)
        with check (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint);
    `);
  }

  pgm.sql(`
    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'barbertime_app') then
        grant select, insert, update, delete on all tables in schema public to barbertime_app;
        grant usage, select on all sequences in schema public to barbertime_app;
      end if;
    end $$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    drop table if exists agendamentos, clientes, barbeiros, produtos, servicos cascade;
    alter table barbearias drop column if exists token_publico;
  `);
};
