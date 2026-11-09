import { formatarData, formatarDiaCurto, formatarMoeda } from './formatacao.js';

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

describe('formatarDiaCurto', () => {
  it.each([
    ['2026-11-08', 'Dom, 8/11'],
    ['2026-11-07', 'Sáb, 7/11'],
    ['2026-01-05', 'Seg, 5/1'],
    ['', ''],
  ])('%s → %s', (iso, esperado) =>
    expect(formatarDiaCurto(iso)).toBe(esperado),
  );
});
