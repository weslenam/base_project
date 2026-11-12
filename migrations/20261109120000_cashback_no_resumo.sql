-- Planejamento 0037: o cashback usado abate como desconto, então o faturamento
-- do mês na lista do Business Center desconta cashback_usado (como o caixa).
-- Mesmo corpo da migração 20261108140000, só com o abatimento.
create or replace function app.resumo_barbearias()
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
             greatest(0,
               (select coalesce(sum((i->>'preco')::numeric * coalesce((i->>'quantidade')::int, 1)), 0)
                  from jsonb_array_elements(cm.itens) i) - cm.desconto - cm.cashback_usado
             ) as total
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

revoke execute on function app.resumo_barbearias() from public;
grant execute on function app.resumo_barbearias() to barbertime_app;
