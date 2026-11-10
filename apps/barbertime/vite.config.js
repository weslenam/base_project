/// <reference types='vitest' />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

// Implementação ativa do design system (skill design-system / ADR 0007).
// Telas importam só '@barbertime/ui'; o alias escolhe a lib concreta.
const ui = process.env.UI_IMPL || 'vuetify';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/barbertime',
  resolve: {
    alias: {
      '@barbertime/ui': fileURLToPath(
        new URL(`../../libs/ui-${ui}/src/index.ts`, import.meta.url),
      ),
    },
  },
  server: {
    port: 4200,
    // No Docker (ADR 0002): VITE_HOST=0.0.0.0 e API_URL=http://api:3333.
    host: process.env.VITE_HOST || 'localhost',
    proxy: {
      '/api': process.env.API_URL || 'http://localhost:3333',
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [vue(), nxReadySignal()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  test: {
    name: 'barbertime',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/testes/setup.ts'],
    server: { deps: { inline: ['vuetify'] } },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
}));
