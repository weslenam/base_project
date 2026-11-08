// Planejamento 0026 (achado N4 do 0025): excluir cliente anonimiza em vez de
// apagar. Nome vira "Cliente removido", telefone/CPF/observações somem (LGPD),
// e atendimentos e comandas continuam no histórico e no faturamento.
// A chave estrangeira dos atendimentos deixa de apagar em cascata.

const fkDoCliente = `
  select conname from pg_constraint
   where conrelid = 'atendimentos'::regclass
     and confrelid = 'clientes'::regclass
     and contype = 'f'`;

export const up = (pgm) => {
  pgm.sql(`
    alter table clientes
      add column excluido_em timestamptz,
      alter column telefone drop not null;

    do $$
    declare nome text;
    begin
      for nome in ${fkDoCliente} loop
        execute format('alter table atendimentos drop constraint %I', nome);
      end loop;
    end $$;
    alter table atendimentos
      add constraint atendimentos_cliente_id_fkey
      foreign key (cliente_id) references clientes (id) on delete restrict;

    -- Uma conta liga a no máximo um barbeiro ativo (agenda própria, planejamento 0026).
    create unique index barbeiros_usuario_unico on barbeiros (usuario_id)
      where usuario_id is not null and excluido_em is null;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    -- Cliente anonimizado não tem telefone e guarda histórico: voltar exigiria
    -- apagar atendimentos pagos. Melhor recusar a volta.
    do $$
    begin
      if exists (select 1 from clientes where telefone is null) then
        raise exception 'Há clientes anonimizados; a migração não pode ser desfeita sem perder histórico.';
      end if;
    end $$;
    drop index if exists barbeiros_usuario_unico;
    alter table atendimentos drop constraint if exists atendimentos_cliente_id_fkey;
    alter table atendimentos
      add constraint atendimentos_cliente_id_fkey
      foreign key (cliente_id) references clientes (id) on delete cascade;
    alter table clientes
      alter column telefone set not null,
      drop column excluido_em;
  `);
};
