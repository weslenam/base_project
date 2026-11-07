import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

describe('ui-tokens', () => {
  it.each([
    '--ds-fonte-base',
    '--ds-cor-fundo',
    '--ds-cor-texto',
    '--ds-espaco-lg',
  ])('define %s', (token) => {
    expect(css).toContain(`${token}:`);
  });
});
