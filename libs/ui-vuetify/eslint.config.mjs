import vue from 'eslint-plugin-vue';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
];
