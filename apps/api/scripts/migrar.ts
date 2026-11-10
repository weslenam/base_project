// Aplica as migrações pendentes: pnpm nx run api:migrar
import { config } from '../src/infra/config.ts';
import { migrar, prepararPapelDaAplicacao } from '../src/infra/migrar.ts';

await migrar(config.databaseUrlMigracao, { log: console.log });
await prepararPapelDaAplicacao(config.databaseUrlMigracao, config.databaseUrl);
console.log('Migrações aplicadas.');
