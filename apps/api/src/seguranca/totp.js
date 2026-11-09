import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// TOTP (RFC 6238 sobre o HOTP da RFC 4226) para os operadores do Business Center
// (planejamento 0028, ADR 0018). SHA-1, 6 dígitos e passo de 30s, que é o padrão
// dos apps autenticadores. Sem dependência externa.

export const PASSO_S = 30;
const DIGITOS = 6;
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let saida = '';
  for (let i = 0; i < bits.length; i += 5)
    saida += ALFABETO[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return saida;
}

export function deBase32(texto) {
  const limpo = String(texto).replace(/[\s=]/g, '').toUpperCase();
  let bits = '';
  for (const ch of limpo) {
    const v = ALFABETO.indexOf(ch);
    if (v < 0) throw new Error('Segredo TOTP inválido.');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Segredo novo de 160 bits, em base32 (o formato que o app autenticador lê). */
export const gerarSegredo = () => base32(randomBytes(20));

export const passoAtual = (agoraMs = Date.now()) =>
  Math.floor(agoraMs / 1000 / PASSO_S);

/** Código de 6 dígitos de um passo. */
export function codigoDoPasso(segredo, passo) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const hmac = createHmac('sha1', deBase32(segredo)).update(contador).digest();
  const deslocamento = hmac[hmac.length - 1] & 0x0f;
  const numero = hmac.readUInt32BE(deslocamento) & 0x7fffffff;
  return String(numero % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

const iguais = (a, b) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Confere o código com tolerância de ±1 passo (relógio do celular adiantado ou
 * atrasado). Devolve o passo aceito, ou null. Passos até `ultimoPasso` são
 * recusados: o mesmo código não vale duas vezes.
 */
export function verificarTotp(
  segredo,
  codigo,
  { ultimoPasso = 0, agoraMs = Date.now() } = {},
) {
  const informado = String(codigo ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(informado)) return null;
  const atual = passoAtual(agoraMs);
  for (const passo of [atual - 1, atual, atual + 1]) {
    if (passo <= ultimoPasso) continue;
    if (iguais(codigoDoPasso(segredo, passo), informado)) return passo;
  }
  return null;
}

/** URI que o app autenticador lê (via QR code). */
export const uriOtpauth = (
  segredo,
  email,
  emissor = 'BarberTime Business Center',
) =>
  `otpauth://totp/${encodeURIComponent(`${emissor}:${email}`)}?secret=${segredo}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASSO_S}`;
