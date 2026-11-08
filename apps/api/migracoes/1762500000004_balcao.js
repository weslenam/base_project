// Planejamento 0020 (fase 1) / especificação docs/atendimento/balcao.md:
// entidade única `atendimentos` (agenda e fila são visões dela), bloqueios à
// parte, pausa do barbeiro, caixa do dia e comandas ligadas ao atendimento.

const RLS = (tabela) => `
  create index ${tabela}_barbearia on ${tabela} (barbearia_id);
  alter table ${tabela} enable row level security;
  alter table ${tabela} force row level security;
  create policy ${tabela}_da_barbearia on ${tabela}
    using (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint)
    with check (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint);
`;

export const up = (pgm) => {
  pgm.sql(`
    alter table barbeiros add column em_pausa boolean not null default false;

    create table bloqueios (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      barbeiro_id bigint not null references barbeiros (id),
      data date not null,
      inicio text not null,
      fim text not null,
      motivo text not null default 'Bloqueado',
      cancelado boolean not null default false,
      check (inicio < fim)
    );
    ${RLS('bloqueios')}

    alter table agendamentos rename to atendimentos;
    alter policy agendamentos_da_barbearia on atendimentos rename to atendimentos_da_barbearia;
    alter index agendamentos_barbearia rename to atendimentos_barbearia;
    alter index agendamentos_dia rename to atendimentos_dia;
    alter index agendamentos_cliente rename to atendimentos_cliente;
    alter sequence agendamentos_id_seq rename to atendimentos_id_seq;

    -- Bloqueios saem para a tabela própria.
    insert into bloqueios (barbearia_id, barbeiro_id, data, inicio, fim, motivo)
      select barbearia_id, barbeiro_id, data, inicio, fim, coalesce(motivo, 'Bloqueado')
        from atendimentos where estado = 'bloqueado';
    delete from atendimentos where estado = 'bloqueado';

    alter table atendimentos drop constraint if exists agendamentos_estado_check;
    alter table atendimentos drop constraint if exists agendamentos_origem_check;
    alter table atendimentos drop constraint if exists agendamentos_check;
    alter table atendimentos rename column origem to canal;
    alter table atendimentos
      add column origem text not null default 'agendamento',
      add column cliente_nome text,
      add column duracao int,
      add column confirmado_em timestamptz,
      add column chegou_em timestamptz,
      add column iniciado_em timestamptz,
      add column finalizado_em timestamptz,
      alter column inicio drop not null,
      alter column fim drop not null,
      alter column barbeiro_id drop not null;

    -- Status do ciclo de vida da especificação.
    update atendimentos set confirmado_em = criado_em where estado = 'confirmado';
    update atendimentos set estado = case estado
      when 'pendente' then 'agendado'
      when 'confirmado' then 'agendado'
      when 'atendido' then 'finalizado'
      when 'faltou' then 'no_show'
      else estado end;
    update atendimentos a set duracao = s.duracao from servicos s where s.id = a.servico_id;

    alter table atendimentos
      add constraint atendimentos_estado check (estado in
        ('agendado', 'chegou', 'na_fila', 'em_atendimento', 'finalizado', 'pago', 'desistiu', 'no_show', 'cancelado')),
      add constraint atendimentos_origem check (origem in ('agendamento', 'avulso')),
      add constraint atendimentos_canal check (canal in ('balcao', 'publico')),
      add constraint atendimentos_horario check (inicio is null or fim is null or inicio < fim),
      -- Agendado precisa de barbeiro e horário; avulso na fila pode ser "primeiro livre".
      add constraint atendimentos_agendado_completo check (
        origem <> 'agendamento' or (barbeiro_id is not null and inicio is not null and fim is not null));

    create table caixas (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      data date not null,
      valor_inicial numeric(10, 2) not null default 0 check (valor_inicial >= 0),
      aberto boolean not null default true,
      aberto_as text not null,
      fechado_as text,
      dinheiro_contado numeric(10, 2),
      diferenca numeric(10, 2),
      unique (barbearia_id, data)
    );
    ${RLS('caixas')}

    create table comandas (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      caixa_id bigint not null references caixas (id),
      atendimento_id bigint unique references atendimentos (id) on delete set null,
      cliente_id bigint references clientes (id) on delete set null,
      barbeiro_id bigint references barbeiros (id),
      hora text not null,
      -- Itens congelados no momento da venda: { tipo, refId, nome, preco, quantidade, barbeiroId }.
      itens jsonb not null default '[]'::jsonb,
      desconto numeric(10, 2) not null default 0 check (desconto >= 0),
      forma text,
      estado text not null default 'aberta' check (estado in ('aberta', 'paga', 'cancelada')),
      paga_as text
    );
    ${RLS('comandas')}
    create index comandas_caixa on comandas (caixa_id);
    create index comandas_cliente on comandas (cliente_id);

    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'barbertime_app') then
        grant select, insert, update, delete on all tables in schema public to barbertime_app;
        grant usage, select on all sequences in schema public to barbertime_app;
      end if;
    end $$;
  `);
};

export const down = () => {
  throw new Error('Migração do Balcão não tem volta automática.');
};
