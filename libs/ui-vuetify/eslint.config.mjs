import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...vue.configs['flat/recommended'],
  // A formatação é do Prettier: desliga as regras de estilo que conflitam.
  prettier,
  // <script lang="ts"> nos .vue: o parser de TypeScript dentro do parser do Vue.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
];
