-- Planejamento 0034, etapa A: fidelidade no banco (regras do planejamento 0015).
-- Configuração por barbearia, extrato só de inserção e o resgate na comanda.

create table app.fidelidade_config (
  barbearia_id bigint primary key references app.barbearias (id) on delete cascade,
  selos_ativo boolean not null default false,
  selos_necessarios integer not null default 10 check (selos_necessarios >= 2),
  premio_servico_id bigint references app.servicos (id),
  selos_validade_meses integer check (selos_validade_meses >= 1),
  cashback_ativo boolean not null default false,
  cashback_percentual numeric(5, 2) not null default 5
    check (cashback_percentual > 0 and cashback_percentual <= 50),
  cashback_validade_dias integer not null default 90 check (cashback_validade_dias >= 1),
  atualizado_em timestamptz not null default now()
);

-- Extrato do cliente: créditos (selo, cashback) e gastos (resgate_selos,
-- uso_cashback). Nunca se altera nem se apaga uma linha: o saldo é a soma.
create table app.fidelidade_movimentos (
  id bigint generated always as identity primary key,
  barbearia_id bigint not null references app.barbearias (id) on delete cascade,
  cliente_id bigint not null references app.clientes (id),
  tipo text not null check (tipo in ('selo', 'cashback', 'resgate_selos', 'uso_cashback')),
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  expira_em date,
  comanda_id bigint references app.comandas (id),
  criado_em timestamptz not null default now()
);
create index fidelidade_movimentos_cliente on app.fidelidade_movimentos (barbearia_id, cliente_id);
-- Uma comanda credita e gasta cada tipo no máximo uma vez (receber duas vezes
-- não duplica nada, nem numa corrida).
create unique index fidelidade_movimentos_uma_vez
  on app.fidelidade_movimentos (comanda_id, tipo) where comanda_id is not null;

-- Resgate na comanda: prêmio dos selos e cashback usado (abate do total).
alter table app.comandas
  add column premio_fidelidade boolean not null default false,
  add column cashback_usado numeric(12, 2) not null default 0 check (cashback_usado >= 0);

alter table app.fidelidade_config enable row level security;
alter table app.fidelidade_config force row level security;
create policy fidelidade_config_da_barbearia on app.fidelidade_config
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

alter table app.fidelidade_movimentos enable row level security;
alter table app.fidelidade_movimentos force row level security;
create policy fidelidade_movimentos_da_barbearia on app.fidelidade_movimentos
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

grant select, insert, update on app.fidelidade_config to barbertime_app;
revoke delete on app.fidelidade_config from barbertime_app;
grant select, insert on app.fidelidade_movimentos to barbertime_app;
revoke update, delete on app.fidelidade_movimentos from barbertime_app;
