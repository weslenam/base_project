import { describe, expect, it } from 'vitest';
import { comoSuperusuario } from './apoio.js';

// Planejamento 0025, sprint S2 (ADR 0017): o schema `app` é fechado por padrão.
// Estes testes travam regressão quando uma migração nova esquecer RLS ou privilégio.

/** Tabelas globais (sem barbearia): acesso só pela API. RLS nelas vem na S4. */
const GLOBAIS = [
  'barbearias',
  'usuarios',
  'sessoes',
  'redefinicoes_senha',
  // Business Center (planejamento 0028): identidade e auditoria da plataforma.
  'operadores',
  'sessoes_operador',
  'auditoria_plataforma',
];

const consultar = (sql, params) =>
  comoSuperusuario(async (c) => (await c.query(sql, params)).rows);

describe('isolamento do schema app', () => {
  it('toda tabela de barbearia tem RLS ligado e forçado', async () => {
    const tabelas = await consultar(
      `select c.relname as nome, c.relrowsecurity as rls, c.relforcerowsecurity as forcado
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'app' and c.relkind = 'r'`,
    );
    expect(tabelas.length).toBeGreaterThan(20);
    const semRls = tabelas
      .filter((t) => !GLOBAIS.includes(t.nome))
      .filter((t) => !t.rls || !t.forcado)
      .map((t) => t.nome);
    expect(semRls).toEqual([]);
  });

  it('toda tabela com barbearia_id tem política pela barbearia atual', async () => {
    const semPolitica = await consultar(
      `select distinct col.table_name as nome
         from information_schema.columns col
        where col.table_schema = 'app' and col.column_name = 'barbearia_id'
          and not exists (
            select 1 from pg_policies p
             where p.schemaname = 'app' and p.tablename = col.table_name
               and p.qual like '%barbearia_atual()%'
               and p.with_check like '%barbearia_atual()%')`,
    );
    expect(
      semPolitica.map((t) => t.nome).filter((n) => !GLOBAIS.includes(n)),
    ).toEqual([]);
  });

  it('papéis do Supabase não enxergam nada em app', async () => {
    const papeis = (
      await consultar(
        "select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role')",
      )
    ).map((r) => r.rolname);
    for (const papel of papeis) {
      const [esquema] = await consultar(
        "select has_schema_privilege($1, 'app', 'usage') as usa",
        [papel],
      );
      expect(esquema.usa, `${papel} usa o schema app`).toBe(false);
      const comAcesso = await consultar(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'app' and c.relkind = 'r'
            and (has_table_privilege($1, c.oid, 'select')
              or has_table_privilege($1, c.oid, 'insert')
              or has_table_privilege($1, c.oid, 'update')
              or has_table_privilege($1, c.oid, 'delete'))`,
        [papel],
      );
      expect(
        comAcesso.map((t) => t.relname),
        papel,
      ).toEqual([]);
    }
  });

  it('o papel da aplicação não ignora RLS nem apaga usuários e barbearias', async () => {
    const [papel] = await consultar(
      "select rolsuper, rolbypassrls from pg_roles where rolname = 'barbertime_app'",
    );
    expect(papel).toEqual({ rolsuper: false, rolbypassrls: false });
    const [apaga] = await consultar(
      `select has_table_privilege('barbertime_app', 'app.usuarios', 'delete') as usuarios,
              has_table_privilege('barbertime_app', 'app.barbearias', 'delete') as barbearias`,
    );
    expect(apaga).toEqual({ usuarios: false, barbearias: false });
  });
});
