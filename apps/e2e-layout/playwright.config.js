import { defineConfig } from '@playwright/test';
import { ambienteDoNavegador } from './apoio/navegador.js';

// Testes de regressão de layout (ADR 0020, planejamento 0032).
// Rodam contra o ambiente de desenvolvimento no ar (pnpm dev + semente).
// Sobrescreva as URLs com APP_URL e BC_URL se usar outras portas.
export default defineConfig({
  testDir: './specs',
  globalSetup: './apoio/entrar.js',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    launchOptions: { env: ambienteDoNavegador() },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'celular',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
