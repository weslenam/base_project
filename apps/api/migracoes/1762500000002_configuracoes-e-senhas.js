// Planejamento 0017 / ADR 0012: configurações da barbearia, permissão
// barbearia.configurar no Dono e verificação para o Dono definir senha provisória.

export const up = (pgm) => {
  pgm.sql(`
    alter table barbearias
      add column configuracoes jsonb not null default '{}'::jsonb;

    update papeis
       set permissoes = array(select distinct unnest(permissoes || array['barbearia.configurar']::text[]) order by 1)
     where chave = 'dono';
  `);

  // A conta é global; o Dono só pode definir senha de quem tem acesso apenas à
  // barbearia dele. O RLS esconde os vínculos de outras barbearias, então a
  // verificação roda como SECURITY DEFINER e devolve só um booleano.
  pgm.sql(`
    create function usuario_so_na_barbearia(p_usuario bigint, p_barbearia bigint)
    returns boolean
    language sql stable security definer set search_path = public as $$
      select exists (select 1 from vinculos where usuario_id = p_usuario and barbearia_id = p_barbearia)
         and not exists (select 1 from vinculos where usuario_id = p_usuario and barbearia_id <> p_barbearia)
    $$;
    revoke all on function usuario_so_na_barbearia(bigint, bigint) from public;
    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'barbertime_app') then
        grant execute on function usuario_so_na_barbearia(bigint, bigint) to barbertime_app;
      end if;
    end $$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    drop function if exists usuario_so_na_barbearia(bigint, bigint);
    update papeis set permissoes = array_remove(permissoes, 'barbearia.configurar');
    alter table barbearias drop column if exists configuracoes;
  `);
};
