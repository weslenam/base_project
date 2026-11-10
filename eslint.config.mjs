import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/javascript'],
  // TypeScript (planejamento 0040, ADR 0022).
  ...nx.configs['flat/typescript'],
  {
    ignores: [
      '**/dist',
      '**/test-output',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.vue'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            // Front e back não se importam entre si; código comum vai para scope:shared.
            {
              sourceTag: 'scope:front',
              onlyDependOnLibsWithTags: ['scope:front', 'scope:shared'],
            },
            {
              sourceTag: 'scope:back',
              onlyDependOnLibsWithTags: ['scope:back', 'scope:shared'],
            },
            // Libs de UI só dependem de outras libs de UI.
            { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui'] },
          ],
        },
      ],
    },
  },
];
