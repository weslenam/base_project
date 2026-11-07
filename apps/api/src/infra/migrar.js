import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

export const PASTA_DE_MIGRACOES = fileURLToPath(
  new URL('../../migracoes', import.meta.url),
);

/** Aplica as migrações pendentes com o superusuário. */
export function migrar(databaseUrl, { log = () => undefined } = {}) {
  return runner({
    databaseUrl,
    dir: PASTA_DE_MIGRACOES,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log,
  });
}
