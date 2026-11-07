import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...vue.configs['flat/recommended'],
  // A formatação é do Prettier: desliga as regras de estilo que conflitam.
  prettier,
  {
    files: ['**/*.js', '**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
];
