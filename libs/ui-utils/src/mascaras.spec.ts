import {
  somenteDigitos,
  formatarTelefone,
  validarTelefone,
  formatarCpf,
  validarCpf,
  formatarDecimal,
  centavosParaReais,
} from './mascaras.ts';

describe('somenteDigitos', () => {
  it.each([
    ['(11) 98765-4321', '11987654321'],
    [null, ''],
    [123, '123'],
  ])('%s → %s', (entrada, saida) =>
    expect(somenteDigitos(entrada)).toBe(saida),
  );
});

describe('formatarTelefone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['119', '(11) 9'],
    ['1198765', '(11) 9876-5'],
    ['1134567890', '(11) 3456-7890'],
    ['11987654321', '(11) 98765-4321'],
    ['119876543210000', '(11) 98765-4321'],
  ])('%s → %s', (entrada, saida) =>
    expect(formatarTelefone(entrada)).toBe(saida),
  );
});

describe('validarTelefone', () => {
  it.each(['11987654321', '(21) 3456-7890'])('aceita %s', (v) =>
    expect(validarTelefone(v)).toBe(true),
  );
  it.each(['', '1198765432', '11887654321', '01987654321', '1112345678'])(
    'rejeita %s',
    (v) => expect(validarTelefone(v)).toBe(false),
  );
});

describe('formatarCpf', () => {
  it.each([
    ['', ''],
    ['123', '123'],
    ['1234', '123.4'],
    ['1234567', '123.456.7'],
    ['1234567890', '123.456.789-0'],
    ['12345678909', '123.456.789-09'],
  ])('%s → %s', (entrada, saida) => expect(formatarCpf(entrada)).toBe(saida));
});

describe('validarCpf', () => {
  it.each(['12345678909', '529.982.247-25'])('aceita %s', (v) =>
    expect(validarCpf(v)).toBe(true),
  );
  it.each(['', '12345678900', '11111111111', '1234567890'])('rejeita %s', (v) =>
    expect(validarCpf(v)).toBe(false),
  );
});

describe('moeda', () => {
  it('formatarDecimal', () => {
    expect(formatarDecimal(1234.5)).toBe('1.234,50');
    expect(formatarDecimal(null)).toBe('');
  });
  it('centavosParaReais', () => {
    expect(centavosParaReais('123456')).toBe(1234.56);
    expect(centavosParaReais('R$ 0,05')).toBe(0.05);
    expect(centavosParaReais('')).toBeNull();
  });
});
