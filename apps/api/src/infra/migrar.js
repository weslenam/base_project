import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Migrações SQL em supabase/migrations (ADR 0015, planejamento 0025 S1).
// O Supabase CLI aplica as mesmas no banco de desenvolvimento
// (supabase db reset / migration up). Este executor aplica num banco qualquer:
// o de testes (barbertime_teste), o do CI ou o Postgres do compose (volta atrás).
// Reconhece as versões já aplicadas pelo CLI (supabase_migrations) e as próprias
// (public.migracoes_aplicadas), para os dois conviverem.

export const PASTA_DE_MIGRACOES = fileURLToPath(
  new URL('../../../../supabase/migrations', import.meta.url),
);

const versaoDe = (arquivo) => arquivo.split('_')[0];

export function migracoesDisponiveis() {
  return readdirSync(PASTA_DE_MIGRACOES)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
}

async function versoesAplicadas(c) {
  await c.query(
    `create table if not exists public.migracoes_aplicadas (
       versao text primary key, nome text not null, aplicada_em timestamptz not null default now())`,
  );
  const proprias = (
    await c.query('select versao from public.migracoes_aplicadas')
  ).rows.map((r) => r.versao);
  const { rows: cli } = await c.query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as existe",
  );
  const doCli = cli[0].existe
    ? (
        await c.query('select version from supabase_migrations.schema_migrations')
      ).rows.map((r) => r.version)
    : [];
  return new Set([...proprias, ...doCli]);
}

/** Aplica as migrações pendentes com o superusuário, cada uma numa transação. */
export async function migrar(databaseUrl, { log = () => undefined } = {}) {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    const aplicadas = await versoesAplicadas(c);
    for (const arquivo of migracoesDisponiveis()) {
      const versao = versaoDe(arquivo);
      if (aplicadas.has(versao)) continue;
      const sql = readFileSync(`${PASTA_DE_MIGRACOES}/${arquivo}`, 'utf8');
      await c.query('begin');
      try {
        await c.query(sql);
        await c.query(
          'insert into public.migracoes_aplicadas (versao, nome) values ($1, $2)',
          [versao, arquivo],
        );
        await c.query('commit');
        log(`migração aplicada: ${arquivo}`);
      } catch (erro) {
        await c.query('rollback');
        throw new Error(`Falha na migração ${arquivo}: ${erro.message}`);
      }
    }
  } finally {
    await c.end();
  }
}

/**
 * Dá LOGIN e senha ao papel da aplicação (criado sem login pela baseline),
 * a partir de DATABASE_URL. A senha nunca vai para o git.
 */
export async function prepararPapelDaAplicacao(databaseUrlMigracao, databaseUrl) {
  const { username, password } = new URL(databaseUrl);
  if (username !== 'barbertime_app')
    throw new Error('DATABASE_URL precisa usar o papel barbertime_app.');
  const c = new pg.Client({ connectionString: databaseUrlMigracao });
  await c.connect();
  try {
    await c.query(
      `alter role barbertime_app login password ${c.escapeLiteral(decodeURIComponent(password))}`,
    );
  } finally {
    await c.end();
  }
}
