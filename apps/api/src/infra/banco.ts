import fp from 'fastify-plugin';
import pg from 'pg';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import type { DB } from './banco-tipos.ts';

// bigint (id) chega como string no pg; ids cabem em Number com folga.
pg.types.setTypeParser(20, (v) => Number(v));
// date chega como 'AAAA-MM-DD' (sem fuso, como no domínio) e numeric como Number.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => Number(v));

/** Kysely com os tipos gerados do banco (pnpm banco:tipos, ADR 0022). */
export type Banco = Kysely<DB>;

/**
 * Conexão de uma transação: `query` (SQL do driver pg, para o código ainda
 * não convertido) e `db` (Kysely na MESMA conexão, planejamento 0040).
 * Tudo o que roda por aqui enxerga só a barbearia da transação (RLS).
 */
export type Conexao = pg.PoolClient & { db: Banco };

/** Quem roda SQL do driver: o pool (fora de transação) ou uma conexão. */
export type ExecutorSql = pg.Pool | pg.PoolClient;

/**
 * Kysely preso a uma conexão já em transação. Não abre transação própria
 * (`transaction()` e `startTransaction()` lançam erro: um BEGIN/COMMIT por
 * dentro encerraria a transação da requisição e o app.barbearia_id dela) e
 * recusa qualquer consulta depois que a transação acaba: a conexão volta ao
 * pool e pode estar servindo outra barbearia.
 */
function kyselyNaConexao(
  cliente: pg.PoolClient,
  estado: { aberta: boolean },
): Banco {
  const conexao = {
    query: (sql: string, parametros?: unknown[]) => {
      if (!estado.aberta)
        throw new Error(
          'Consulta fora da transação da requisição (planejamento 0040): use o `c.db` só dentro do naBarbearia/emTransacao.',
        );
      return cliente.query(sql, parametros);
    },
    release: () => undefined,
  };
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: {
        connect: async () => conexao,
        end: async () => undefined,
      } as never,
    }),
    // Colunas em snake_case no banco, camelCase no código; o JSON das
    // colunas jsonb (ex.: itens da comanda) fica como foi gravado.
    plugins: [new CamelCasePlugin({ maintainNestedObjectKeys: true })],
  });
  const proibida = () => {
    throw new Error(
      'O `c.db` já está na transação da requisição: não abra outra (planejamento 0040).',
    );
  };
  return Object.assign(db, {
    transaction: proibida,
    startTransaction: proibida,
  }) as Banco;
}

async function naTransacao<T>(
  pool: pg.Pool,
  preparar: ((c: pg.PoolClient) => Promise<unknown>) | null,
  fn: (c: Conexao) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();
  const estado = { aberta: true };
  // O Kysely só é montado se a rota usar o `c.db` (as que usam só `c.query`
  // não pagam o custo).
  let db: Banco | null = null;
  const conexao = cliente as Conexao;
  Object.defineProperty(conexao, 'db', {
    configurable: true,
    get: () => (db ??= kyselyNaConexao(cliente, estado)),
  });
  // Erro que tornou a conexão inutilizável: ela é descartada, não volta ao pool.
  let conexaoQuebrada: Error | undefined;
  try {
    await cliente.query('begin');
    if (preparar) await preparar(cliente);
    const resultado = await fn(conexao);
    await cliente.query('commit');
    return resultado;
  } catch (erro) {
    try {
      await cliente.query('rollback');
    } catch (erroNoRollback) {
      // O erro original é o que importa para quem chamou (issue #35).
      conexaoQuebrada = erroNoRollback as Error;
    }
    throw erro;
  } finally {
    estado.aberta = false;
    // O cliente volta ao pool sem o `db` desta transação.
    delete (cliente as Partial<Conexao>).db;
    cliente.release(conexaoQuebrada);
  }
}

/**
 * Executa fn(conexão) numa transação com app.barbearia_id definido: as
 * políticas de RLS só enxergam dados dessa barbearia (ADRs 0001 e 0009).
 */
export function comBarbearia<T>(
  pool: pg.Pool,
  barbeariaId: number,
  fn: (c: Conexao) => Promise<T>,
): Promise<T> {
  return naTransacao(
    pool,
    (c) =>
      c.query("select set_config('app.barbearia_id', $1, true)", [
        String(barbeariaId),
      ]),
    fn,
  );
}

/** Transação sem barbearia (tabelas globais: usuários, sessões, barbearias). */
export function emTransacao<T>(
  pool: pg.Pool,
  fn: (c: Conexao) => Promise<T>,
): Promise<T> {
  return naTransacao(pool, null, fn);
}

/** Plugin: fastify.db (pool), fastify.comBarbearia(id, fn) e fastify.emTransacao(fn). */
export default fp(async function banco(
  fastify,
  { databaseUrl }: { databaseUrl: string },
) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  fastify.decorate('db', pool);
  fastify.decorate(
    'comBarbearia',
    <T>(id: number, fn: (c: Conexao) => Promise<T>) =>
      comBarbearia(pool, id, fn),
  );
  fastify.decorate('emTransacao', <T>(fn: (c: Conexao) => Promise<T>) =>
    emTransacao(pool, fn),
  );
  fastify.addHook('onClose', () => pool.end());
});
