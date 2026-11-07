import fp from 'fastify-plugin';
import pg from 'pg';

// bigint (id) chega como string no pg; ids cabem em Number com folga.
pg.types.setTypeParser(20, (v) => Number(v));

/**
 * Executa fn(cliente) numa transação com app.barbearia_id definido: as políticas
 * de RLS só enxergam dados dessa barbearia (ADRs 0001 e 0009).
 */
export async function comBarbearia(pool, barbeariaId, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await cliente.query("select set_config('app.barbearia_id', $1, true)", [
      String(barbeariaId),
    ]);
    const resultado = await fn(cliente);
    await cliente.query('commit');
    return resultado;
  } catch (erro) {
    await cliente.query('rollback');
    throw erro;
  } finally {
    cliente.release();
  }
}

/** Transação sem barbearia (tabelas globais: usuários, sessões, barbearias). */
export async function emTransacao(pool, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    const resultado = await fn(cliente);
    await cliente.query('commit');
    return resultado;
  } catch (erro) {
    await cliente.query('rollback');
    throw erro;
  } finally {
    cliente.release();
  }
}

/** Plugin: fastify.db (pool) e fastify.comBarbearia(id, fn). */
export default fp(async function banco(fastify, { databaseUrl }) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  fastify.decorate('db', pool);
  fastify.decorate('comBarbearia', (id, fn) => comBarbearia(pool, id, fn));
  fastify.decorate('emTransacao', (fn) => emTransacao(pool, fn));
  fastify.addHook('onClose', () => pool.end());
});
