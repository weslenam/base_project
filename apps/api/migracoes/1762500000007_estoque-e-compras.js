// Planejamento 0027 (parte 1): estoque por movimentos, ficha técnica, fornecedores
// e compras que geram contas a pagar. As contas e categorias nascem aqui porque a
// compra gera as parcelas; as telas do financeiro vêm na parte 2.
//
// Chaves estrangeiras compostas (barbearia_id, id): uma linha nunca aponta para
// dado de outra barbearia, mesmo que a API erre (a chave estrangeira não passa
// pela RLS).

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
    -- Produtos: tipo, unidade, mínimo, último custo e saldo materializado.
    alter table produtos
      add column tipo text not null default 'revenda' check (tipo in ('revenda', 'consumivel')),
      add column unidade text not null default 'un' check (unidade in ('un', 'ml', 'g', 'cx', 'par')),
      add column estoque_minimo numeric(12, 3) not null default 0 check (estoque_minimo >= 0),
      add column ultimo_custo numeric(12, 2),
      add column saldo numeric(12, 3) not null default 0,
      alter column preco drop not null,
      drop constraint if exists produtos_preco_check;
    alter table produtos
      add constraint produtos_preco_da_revenda
        check ((tipo = 'consumivel') or (preco is not null and preco > 0));
    create unique index produtos_da_barbearia on produtos (barbearia_id, id);
    create unique index servicos_da_barbearia on servicos (barbearia_id, id);
    create unique index clientes_da_barbearia on clientes (barbearia_id, id);

    create table fornecedores (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      nome text not null check (length(trim(nome)) > 0),
      documento text,
      telefone text,
      observacoes text not null default '',
      excluido_em timestamptz,
      unique (barbearia_id, id)
    );
    ${RLS('fornecedores')}

    create table compras (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      fornecedor_id bigint not null,
      data date not null,
      frete numeric(12, 2) not null default 0 check (frete >= 0),
      desconto numeric(12, 2) not null default 0 check (desconto >= 0),
      total numeric(12, 2) not null check (total >= 0),
      observacao text not null default '',
      cancelada_em timestamptz,
      criada_por bigint references usuarios (id),
      criada_em timestamptz not null default now(),
      unique (barbearia_id, id),
      foreign key (barbearia_id, fornecedor_id) references fornecedores (barbearia_id, id)
    );
    ${RLS('compras')}

    create table itens_compra (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      compra_id bigint not null,
      produto_id bigint not null,
      quantidade numeric(12, 3) not null check (quantidade > 0),
      custo_unitario numeric(12, 2) not null check (custo_unitario >= 0),
      foreign key (barbearia_id, compra_id) references compras (barbearia_id, id) on delete cascade,
      foreign key (barbearia_id, produto_id) references produtos (barbearia_id, id)
    );
    ${RLS('itens_compra')}
    create index itens_compra_compra on itens_compra (compra_id);

    create table movimentos_estoque (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      produto_id bigint not null,
      tipo text not null check (tipo in ('compra', 'venda', 'consumo_servico', 'consumo_manual', 'ajuste_inventario', 'estorno_compra')),
      quantidade numeric(12, 3) not null check (quantidade <> 0),
      custo_unitario numeric(12, 2),
      motivo text not null default '',
      comanda_id bigint references comandas (id) on delete set null,
      compra_id bigint,
      usuario_id bigint references usuarios (id),
      criado_em timestamptz not null default now(),
      foreign key (barbearia_id, produto_id) references produtos (barbearia_id, id),
      foreign key (barbearia_id, compra_id) references compras (barbearia_id, id)
    );
    ${RLS('movimentos_estoque')}
    create index movimentos_estoque_produto on movimentos_estoque (produto_id, criado_em desc);

    -- Ficha técnica: quanto de cada consumível o serviço gasta.
    create table fichas_tecnicas (
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      servico_id bigint not null,
      produto_id bigint not null,
      quantidade numeric(12, 3) not null check (quantidade > 0),
      primary key (servico_id, produto_id),
      foreign key (barbearia_id, servico_id) references servicos (barbearia_id, id),
      foreign key (barbearia_id, produto_id) references produtos (barbearia_id, id)
    );
    alter table fichas_tecnicas enable row level security;
    alter table fichas_tecnicas force row level security;
    create policy fichas_tecnicas_da_barbearia on fichas_tecnicas
      using (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint)
      with check (barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint);

    -- Financeiro (base): categorias e contas. As parcelas da compra são contas.
    create table categorias_financeiras (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      tipo text not null check (tipo in ('pagar', 'receber')),
      nome text not null check (length(trim(nome)) > 0),
      ativa boolean not null default true,
      unique (barbearia_id, id)
    );
    ${RLS('categorias_financeiras')}
    create unique index categorias_nome_unico
      on categorias_financeiras (barbearia_id, tipo, lower(nome));

    create table contas (
      id bigserial primary key,
      barbearia_id bigint not null references barbearias (id) on delete cascade,
      tipo text not null check (tipo in ('pagar', 'receber')),
      descricao text not null check (length(trim(descricao)) > 0),
      categoria_id bigint not null,
      valor numeric(12, 2) not null check (valor > 0),
      vencimento date not null,
      fornecedor_id bigint,
      cliente_id bigint,
      compra_id bigint,
      parcela int,
      parcelas int,
      origem text not null default 'manual' check (origem in ('manual', 'compra', 'recorrencia')),
      situacao text not null default 'aberta' check (situacao in ('aberta', 'quitada', 'cancelada')),
      pago_em date,
      valor_pago numeric(12, 2),
      forma text,
      criada_em timestamptz not null default now(),
      foreign key (barbearia_id, categoria_id) references categorias_financeiras (barbearia_id, id),
      foreign key (barbearia_id, fornecedor_id) references fornecedores (barbearia_id, id),
      foreign key (barbearia_id, compra_id) references compras (barbearia_id, id),
      foreign key (barbearia_id, cliente_id) references clientes (barbearia_id, id)
    );
    ${RLS('contas')}
    create index contas_vencimento on contas (barbearia_id, situacao, vencimento);
    create index contas_compra on contas (compra_id);

    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'barbertime_app') then
        grant select, insert, update, delete on all tables in schema public to barbertime_app;
        grant usage, select on all sequences in schema public to barbertime_app;
      end if;
    end $$;
  `);
};

export const down = () => {
  throw new Error('Migração de estoque e compras não tem volta automática.');
};
