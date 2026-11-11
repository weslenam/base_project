import { createHmac } from 'node:crypto';

// Código TOTP (RFC 6238: SHA-1, 6 dígitos, passo de 30s) do operador de
// desenvolvimento. Só gera o código; quem confere é a API (seguranca/totp.js).
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function deBase32(texto: string): Buffer {
  let bits = '';
  for (const c of texto.replace(/=+$/, '').toUpperCase())
    bits += ALFABETO.indexOf(c).toString(2).padStart(5, '0');
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

export const passoAtual = (agoraMs = Date.now()): number =>
  Math.floor(agoraMs / 30_000);

export function codigoDoPasso(segredo: string, passo: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const h = createHmac('sha1', deBase32(segredo)).update(contador).digest();
  const i = h[h.length - 1] & 0xf;
  const n = (h.readUInt32BE(i) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, '0');
}
