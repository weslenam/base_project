-- Planejamento 0027, parte 2 (fatia 2B): recorrências financeiras. Cada
-- recorrência gera contas a pagar ou a receber para os próximos 3 meses
-- automaticamente ao salvar e ao listar.

-- recorrencia_id em contas (FK com chave composta, barbearia não cruza).
alter table app.contas
  add column recorrencia_id bigint;

-- Chave composta em recorrencias (FK de contas vai referenciar).
create table app.recorrencias (
  id               bigint generated always as identity primary key,
  barbearia_id     bigint not null references app.barbearias (id) on delete cascade,
  tipo             text not null check (tipo in ('pagar', 'receber')),
  descricao        text not null check (length(trim(descricao)) between 1 and 200),
  categoria_id     bigint not null references app.categorias_financeiras (id),
  valor            numeric(12, 2) not null check (valor > 0),
  dia_do_mes       int not null check (dia_do_mes between 1 and 28),
  fornecedor_id    bigint,
  encerrada_em     date,
  criado_em        timestamptz not null default now(),
  constraint recorrencias_barbearia_id_id_key unique (barbearia_id, id)
);

-- FK cruzada (barbearia, recorrencia_id) em contas.
alter table app.contas
  add constraint contas_recorrencia_fk
  foreign key (barbearia_id, recorrencia_id)
  references app.recorrencias (barbearia_id, id);

alter table app.recorrencias enable row level security;
alter table app.recorrencias force row level security;
create policy recorrencias_da_barbearia on app.recorrencias
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

grant select, insert, update on app.recorrencias to barbertime_app;
revoke delete on app.recorrencias from barbertime_app;
