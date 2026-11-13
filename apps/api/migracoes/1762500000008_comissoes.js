// Planejamento 0042: comissão por barbeiro.
// Rastreia o percentual de comissão de cada barbeiro sobre o valor líquido das
// comandas pagas. Dois objetos:
//   comissoes      — uma linha por comanda paga (módulo comissoes ativo)
//   comissoes_fechamentos — período "fechado" (pago ao barbeiro) com total

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
    create table comissoes_fechamentos (
      id             serial primary key,
      barbearia_id   bigint not null references barbearias(id),
      barbeiro_id    bigint not null references barbeiros(id),
      de             date   not null,
      ate            date   not null,
      total          numeric(12, 2) not null check (total >= 0),
      fechado_por    bigint references usuarios(id),
      fechado_em     timestamptz not null default now()
    );
    ${RLS('comissoes_fechamentos')}

    create table comissoes (
      id              serial primary key,
      barbearia_id    bigint not null references barbearias(id),
      barbeiro_id     bigint not null references barbeiros(id),
      comanda_id      bigint not null references comandas(id),
      data_comanda    date   not null,
      base_calculo    numeric(12, 2) not null check (base_calculo >= 0),
      taxa            numeric(5, 2)  not null check (taxa >= 0 and taxa <= 100),
      valor           numeric(12, 2) not null check (valor >= 0),
      observacao      text,
      fechamento_id   bigint references comissoes_fechamentos(id),
      unique (comanda_id)
    );
    ${RLS('comissoes')}
  `);
};

export const down = () => {
  throw new Error('Migração de comissões não tem volta automática.');
};
