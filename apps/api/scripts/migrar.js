// Aplica as migrações pendentes: pnpm nx run api:migrar
import { config } from '../src/infra/config.js';
import { migrar, prepararPapelDaAplicacao } from '../src/infra/migrar.js';

await migrar(config.databaseUrlMigracao, { log: console.log });
await prepararPapelDaAplicacao(config.databaseUrlMigracao, config.databaseUrl);
console.log('Migrações aplicadas.');
