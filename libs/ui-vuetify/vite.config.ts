/// <reference types='vitest' />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/ui-vuetify',
  plugins: [vue()],
  test: {
    name: 'ui-vuetify',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,ts}'],
    setupFiles: ['src/testes/setup.ts'],
    // A Vuetify importa CSS de dentro do pacote; precisa passar pelo Vite.
    server: { deps: { inline: ['vuetify'] } },
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
}));
