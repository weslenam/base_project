-- Planejamento 0034, etapa B: pacotes e assinaturas no banco (regras do
-- planejamento 0015). A venda e a renovação passam pelo caixa; o uso é o
-- serviço a R$ 0 na comanda, gravado ao receber.

create table app.pacotes (
  id bigint generated always as identity primary key,
  barbearia_id bigint not null references app.barbearias (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 120),
  preco numeric(12, 2) not null check (preco > 0),
  tipo text not null check (tipo in ('recorrente', 'unico')),
  validade_dias integer check (validade_dias >= 1),
  intervalo_minimo_dias integer check (intervalo_minimo_dias >= 1),
  maximo_por_semana integer check (maximo_por_semana >= 1),
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  check (tipo = 'recorrente' or validade_dias is not null)
);
-- Nome único entre os pacotes não excluídos da barbearia.
create unique index pacotes_nome_unico
  on app.pacotes (barbearia_id, lower(nome)) where excluido_em is null;

-- Serviços do pacote: quantidade por ciclo, ou livre (null).
create table app.pacote_itens (
  pacote_id bigint not null references app.pacotes (id) on delete cascade,
  barbearia_id bigint not null references app.barbearias (id) on delete cascade,
  servico_id bigint not null references app.servicos (id),
  quantidade integer check (quantidade >= 1),
  primary key (pacote_id, servico_id)
);

-- Pacote do cliente. Vale a partir do pagamento da comanda de venda; cada
-- renovação é uma linha nova ligada à anterior (o ciclo atual continua até o fim).
create table app.assinaturas (
  id bigint generated always as identity primary key,
  barbearia_id bigint not null references app.barbearias (id) on delete cascade,
  cliente_id bigint not null references app.clientes (id),
  pacote_id bigint not null references app.pacotes (id),
  estado text not null default 'aguardando_pagamento'
    check (estado in ('aguardando_pagamento', 'ativa', 'cancelada')),
  inicio date,
  fim date,
  comanda_venda_id bigint references app.comandas (id),
  renovacao_de bigint references app.assinaturas (id),
  criado_em timestamptz not null default now(),
  check (estado <> 'ativa' or (inicio is not null and fim is not null))
);
create index assinaturas_cliente on app.assinaturas (barbearia_id, cliente_id);
create index assinaturas_comanda_venda on app.assinaturas (comanda_venda_id);
-- Uma renovação em andamento ou paga por ciclo (decisão 3 do detalhe da etapa B).
create unique index assinaturas_uma_renovacao
  on app.assinaturas (renovacao_de) where renovacao_de is not null and estado <> 'cancelada';

-- Usos do pacote: só inserção, gravados ao receber a comanda.
create table app.usos_assinatura (
  id bigint generated always as identity primary key,
  barbearia_id bigint not null references app.barbearias (id) on delete cascade,
  assinatura_id bigint not null references app.assinaturas (id),
  servico_id bigint not null references app.servicos (id),
  data date not null,
  comanda_id bigint not null references app.comandas (id),
  criado_em timestamptz not null default now()
);
create index usos_assinatura_assinatura on app.usos_assinatura (assinatura_id);

alter table app.pacotes enable row level security;
alter table app.pacotes force row level security;
create policy pacotes_da_barbearia on app.pacotes
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

alter table app.pacote_itens enable row level security;
alter table app.pacote_itens force row level security;
create policy pacote_itens_da_barbearia on app.pacote_itens
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

alter table app.assinaturas enable row level security;
alter table app.assinaturas force row level security;
create policy assinaturas_da_barbearia on app.assinaturas
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

alter table app.usos_assinatura enable row level security;
alter table app.usos_assinatura force row level security;
create policy usos_assinatura_da_barbearia on app.usos_assinatura
  using (barbearia_id = app.barbearia_atual())
  with check (barbearia_id = app.barbearia_atual());

-- Pacote é excluído de forma lógica (excluido_em); itens são trocados ao editar.
grant select, insert, update on app.pacotes to barbertime_app;
revoke delete on app.pacotes from barbertime_app;
grant select, insert, delete on app.pacote_itens to barbertime_app;
grant select, insert, update on app.assinaturas to barbertime_app;
revoke delete on app.assinaturas from barbertime_app;
grant select, insert on app.usos_assinatura to barbertime_app;
revoke update, delete on app.usos_assinatura from barbertime_app;
