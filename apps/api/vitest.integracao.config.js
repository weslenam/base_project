import { defineConfig } from 'vitest/config';

// Testes de integração da API contra o Postgres do Docker: pnpm nx run api:integracao
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api-integracao',
  test: {
    name: 'api-integracao',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/integracao/**/*.spec.{js,ts}'],
    globalSetup: ['src/integracao/preparar.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    reporters: ['default'],
  },
}));
