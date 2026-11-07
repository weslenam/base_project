import vue from 'eslint-plugin-vue';
import baseConfig from '../../eslint.config.mjs';

const mensagem = 'Use @barbertime/ui (skill design-system).';

export default [
  ...baseConfig,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      // Lint de fronteira: telas não falam com o framework de UI.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['vuetify', 'vuetify/*'], message: mensagem },
            { group: ['quasar', 'quasar/*', '@quasar/*'], message: mensagem },
            { group: ['primevue', 'primevue/*'], message: mensagem },
            {
              group: ['@barbertime/ui-vuetify', '@barbertime/ui-vuetify/*'],
              message:
                'Importe @barbertime/ui (o alias escolhe a implementação).',
            },
          ],
        },
      ],
    },
  },
];
