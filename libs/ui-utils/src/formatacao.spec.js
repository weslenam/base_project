import { formatarData, formatarMoeda } from './formatacao.js';

describe('formatarData', () => {
  it('formata em dd/mm/aaaa', () => {
    expect(formatarData('2026-11-07T12:00:00-03:00')).toBe('07/11/2026');
  });

  it.each([null, undefined, '', 'não é data'])('retorna vazio para %s', (v) => {
    expect(formatarData(v)).toBe('');
  });
});

describe('formatarMoeda', () => {
  it('formata em reais', () => {
    // Intl usa espaço não separável entre "R$" e o número.
    expect(formatarMoeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });

  it.each([null, undefined, '', 'abc'])('retorna vazio para %s', (v) => {
    expect(formatarMoeda(v)).toBe('');
  });
});
