/// <reference types='vitest' />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

// BarberTime Business Center (planejamento 0028): app dos operadores da plataforma.
// Implementação ativa do design system (skill design-system / ADR 0007).
// Telas importam só '@barbertime/ui'; o alias escolhe a lib concreta.
const ui = process.env.UI_IMPL || 'vuetify';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/business-center',
  resolve: {
    alias: {
      '@barbertime/ui': fileURLToPath(
        new URL(`../../libs/ui-${ui}/src/index.js`, import.meta.url),
      ),
    },
  },
  server: {
    port: 4300,
    // No Docker (ADR 0002): VITE_HOST=0.0.0.0 e API_URL=http://api:3333.
    host: process.env.VITE_HOST || 'localhost',
    proxy: {
      '/api': process.env.API_URL || 'http://localhost:3333',
    },
  },
  preview: {
    port: 4301,
    host: 'localhost',
  },
  plugins: [vue(), nxReadySignal()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  test: {
    name: 'business-center',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/testes/setup.js'],
    server: { deps: { inline: ['vuetify'] } },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
}));
