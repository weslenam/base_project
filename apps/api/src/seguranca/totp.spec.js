import {
  base32,
  codigoDoPasso,
  deBase32,
  gerarSegredo,
  passoAtual,
  uriOtpauth,
  verificarTotp,
} from './totp.js';

// Vetores da RFC 6238 (apêndice B), SHA-1, truncados para 6 dígitos.
const SEGREDO_RFC = base32(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('bate com os vetores da RFC 6238', () => {
    expect(codigoDoPasso(SEGREDO_RFC, passoAtual(59_000))).toBe('287082');
    expect(codigoDoPasso(SEGREDO_RFC, passoAtual(1_111_111_109_000))).toBe(
      '081804',
    );
    expect(codigoDoPasso(SEGREDO_RFC, passoAtual(1_234_567_890_000))).toBe(
      '005924',
    );
  });

  it('base32 vai e volta e o segredo gerado tem 160 bits', () => {
    const s = gerarSegredo();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(deBase32(s)).toHaveLength(20);
    expect(deBase32(base32(Buffer.from('abc')))).toEqual(Buffer.from('abc'));
  });

  it('aceita ±1 passo e devolve o passo aceito', () => {
    const agoraMs = 1_700_000_000_000;
    const passo = passoAtual(agoraMs);
    for (const delta of [-1, 0, 1]) {
      const codigo = codigoDoPasso(SEGREDO_RFC, passo + delta);
      expect(verificarTotp(SEGREDO_RFC, codigo, { agoraMs })).toBe(
        passo + delta,
      );
    }
    const longe = codigoDoPasso(SEGREDO_RFC, passo + 2);
    expect(verificarTotp(SEGREDO_RFC, longe, { agoraMs })).toBeNull();
  });

  it('não aceita o mesmo código duas vezes nem formato inválido', () => {
    const agoraMs = 1_700_000_000_000;
    const passo = passoAtual(agoraMs);
    const codigo = codigoDoPasso(SEGREDO_RFC, passo);
    expect(
      verificarTotp(SEGREDO_RFC, codigo, { agoraMs, ultimoPasso: passo }),
    ).toBeNull();
    expect(verificarTotp(SEGREDO_RFC, '12345', { agoraMs })).toBeNull();
    expect(verificarTotp(SEGREDO_RFC, 'abcdef', { agoraMs })).toBeNull();
    expect(verificarTotp(SEGREDO_RFC, null, { agoraMs })).toBeNull();
  });

  it('monta a URI do app autenticador', () => {
    expect(uriOtpauth('ABC', 'op@barbertime.dev')).toBe(
      'otpauth://totp/BarberTime%20Business%20Center%3Aop%40barbertime.dev?secret=ABC&issuer=BarberTime%20Business%20Center&algorithm=SHA1&digits=6&period=30',
    );
  });
});
