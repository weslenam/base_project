import { readFileSync } from 'node:fs';
import {
  gerar,
  ORIGEM,
  DESTINO_CSS,
  DESTINO_TS,
} from '../scripts/gerar-tokens.ts';
import { temas, TEMA_PADRAO, espacos, raios, fontes } from './tokens.ts';

const json = JSON.parse(readFileSync(ORIGEM, 'utf8'));
const esperado = gerar(json);

describe('tokens gerados a partir de docs/identidade-visual/tokens.json', () => {
  it('tokens.css está atualizado (rode: pnpm nx run ui-tokens:gerar)', () => {
    expect(readFileSync(DESTINO_CSS, 'utf8')).toBe(esperado.css);
  });

  it('tokens.ts está atualizado (rode: pnpm nx run ui-tokens:gerar)', () => {
    expect(readFileSync(DESTINO_TS, 'utf8')).toBe(esperado.ts);
  });

  it('tema padrão é o claro, e existe o escuro', () => {
    expect(TEMA_PADRAO).toBe('claro');
    expect(temas.claro.id).toBe('light');
    expect(temas.escuro).toMatchObject({ id: 'dark', escuro: true });
  });

  it('os dois temas definem as mesmas cores', () => {
    expect(Object.keys(temas.escuro.cores)).toEqual(
      Object.keys(temas.claro.cores),
    );
  });

  it('expõe cores de marca, espaços, raios e fontes', () => {
    expect(temas.claro.cores.cobre).toMatch(/^#[0-9a-f]{6}$/);
    expect(espacos['esp-4']).toBe('16px');
    expect(raios['raio-sm']).toBeDefined();
    expect(fontes.display).toContain('Big Shoulders');
  });

  it('CSS usa o nome do token como variável e [data-theme] no escuro', () => {
    expect(esperado.css).toContain('--cobre:');
    expect(esperado.css).toContain('--esp-4: 16px;');
    expect(esperado.css).toContain("[data-theme='dark'] {");
  });
});
