-- Planejamento 0028 (ADR 0018): BarberTime Business Center.
-- Operadores da plataforma são uma identidade separada dos usuários de barbearia,
-- com TOTP obrigatório. Toda ação deles vai para uma auditoria que só aceita inserção.

create table app.operadores (
  id bigint generated always as identity primary key,
  nome text not null,
  email text not null,
  senha_hash text not null,
  totp_segredo text not null,
  -- Último passo TOTP aceito: o mesmo código não vale duas vezes.
  totp_ultimo_passo bigint not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index operadores_email_unico on app.operadores (lower(email));

create table app.sessoes_operador (
  id_hash text primary key,
  operador_id bigint not null references app.operadores (id) on delete cascade,
  expira_em timestamptz not null,
  criada_em timestamptz not null default now()
);
create index sessoes_operador_por_operador on app.sessoes_operador (operador_id);

create table app.auditoria_plataforma (
  id bigint generated always as identity primary key,
  operador_id bigint not null references app.operadores (id),
  barbearia_id bigint references app.barbearias (id),
  acao text not null,
  motivo text,
  dados jsonb not null default '{}'::jsonb,
  criada_em timestamptz not null default now()
);
create index auditoria_por_barbearia on app.auditoria_plataforma (barbearia_id, criada_em desc);

alter table app.barbearias
  add column suspensa_em timestamptz,
  add column motivo_suspensao text;

-- Lista do Business Center: só agregados por barbearia (e o Dono, que é da
-- equipe), nunca linhas de cliente ou comanda. security definer porque cruza barbearias; quem chama não escolhe
-- colunas nem filtros. O mês segue o fuso de São Paulo.
create function app.resumo_barbearias()
  returns table (
    barbearia_id bigint,
    faturamento_mes numeric,
    ultima_comanda_paga date,
    modulos_pendentes integer,
    dono_nome text,
    dono_email text
  )
  language sql stable security definer
  set search_path to 'app'
  as $$
    with mes as (
      select date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date as inicio
    ), pagas as (
      select cm.barbearia_id, cx.data,
             (select coalesce(sum((i->>'preco')::numeric * coalesce((i->>'quantidade')::int, 1)), 0)
                from jsonb_array_elements(cm.itens) i) - cm.desconto as total
        from comandas cm join caixas cx on cx.id = cm.caixa_id
       where cm.estado = 'paga'
    )
    select b.id,
           coalesce((select sum(p.total) from pagas p, mes
                      where p.barbearia_id = b.id and p.data >= mes.inicio), 0),
           (select max(p.data) from pagas p where p.barbearia_id = b.id),
           (select count(*)::int from barbearia_modulos bm
             where bm.barbearia_id = b.id and bm.estado = 'solicitado'),
           d.nome, d.email
      from barbearias b
      left join lateral (
        select u.nome, u.email from vinculos v
          join papeis p on p.id = v.papel_id and p.chave = 'dono'
          join usuarios u on u.id = v.usuario_id
         where v.barbearia_id = b.id and v.ativo
         order by v.usuario_id limit 1
      ) d on true
  $$;

-- Privilégios: as tabelas novas herdam o padrão do schema (ADR 0017). A
-- auditoria é só leitura e inserção; a função de resumo, só para a aplicação.
revoke update, delete on app.auditoria_plataforma from barbertime_app;
revoke execute on function app.resumo_barbearias() from public;
grant execute on function app.resumo_barbearias() to barbertime_app;

-- Barbearia suspensa some da lista de quem entra (login e troca de barbearia).
create or replace function app.barbearias_do_usuario(p_usuario bigint)
  returns table(barbearia_id bigint, nome text, slug text)
  language sql stable security definer
  set search_path to 'app'
  as $$
    select b.id, b.nome, b.slug
      from vinculos v join barbearias b on b.id = v.barbearia_id
     where v.usuario_id = p_usuario and v.ativo and b.suspensa_em is null
     order by b.nome
  $$;

-- Login: diz só se o usuário tem acesso ativo a alguma barbearia suspensa, para
-- a mensagem certa ("fale com o suporte"). Os vínculos têm RLS; daí o definer.
create function app.usuario_em_barbearia_suspensa(p_usuario bigint)
  returns boolean
  language sql stable security definer
  set search_path to 'app'
  as $$
    select exists (
      select 1 from vinculos v join barbearias b on b.id = v.barbearia_id
       where v.usuario_id = p_usuario and v.ativo and b.suspensa_em is not null)
  $$;
revoke execute on function app.usuario_em_barbearia_suspensa(bigint) from public;
grant execute on function app.usuario_em_barbearia_suspensa(bigint) to barbertime_app;
