// Aplica as migrações pendentes: pnpm nx run api:migrar
import { config } from '../src/infra/config.js';
import { migrar } from '../src/infra/migrar.js';

await migrar(config.databaseUrlMigracao, { log: console.log });
console.log('Migrações aplicadas.');
