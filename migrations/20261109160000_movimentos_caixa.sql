-- Planejamento 0027, parte 2 (fatia 2A): saídas e entradas da gaveta do caixa
-- vindas da baixa de contas com "dinheiro do caixa". O estorno marca o
-- movimento (estornado_em) em vez de apagar: fica a trilha do que aconteceu.

-- Chaves compostas (barbearia, id) para as referências não cruzarem barbearias,
-- como nas outras tabelas do negócio.
alter table app.caixas
  add constraint caixas_barbearia_id_id_key unique (barbearia_id, id);
alter table app.contas
  add constraint contas_barbearia_id_id_key unique (barbearia_id, id);

create table app.movimentos_caixa (
  id bigint generated always as identity primary key,
  barbearia_id bigint not null references app.barbearias (id) on delete cascade,
  caixa_id bigint not null,
  tipo text not null check (tipo in ('saida', 'entrada')),
  valor numeric(12, 2) not null check (valor > 0),
  descricao text not null check (length(trim(descricao)) between 1 and 200),
  conta_id bigint,
  criado_por bigint,
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  foreign key (barbearia_id, caixa_id) references app.caixas (barbearia_id, id),
  foreign key (barbearia_id, conta_id) references app.contas (barbearia_id, id)
);
create index movimentos_caixa_caixa on app.movimentos_caixa (caixa_id);
-- Uma baixa válida por conta: estornar libera uma nova baixa.
create unique index movimentos_caixa_uma_baixa
  on app.movimentos_caixa (conta_id) where conta_id is not null and estornado_em is null;

alter table app.movimentos_caixa enable row level security;
alter table app.movimentos_caixa force row level security;
create policy movimentos_caixa_da_barbearia on app.movimentos_caixa
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

grant select, insert, update on app.movimentos_caixa to barbertime_app;
revoke delete on app.movimentos_caixa from barbertime_app;
