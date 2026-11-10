import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

const scryptAsync = (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
): Promise<Buffer> =>
  new Promise((ok, falha) =>
    scrypt(senha, sal, tamanho, opcoes, (erro, chave) =>
      erro ? falha(erro) : ok(chave),
    ),
  );
const PARAMETROS = { N: 16384, r: 8, p: 1 };
const TAMANHO = 64;

/** Hash no formato scrypt$N$r$p$sal$hash (base64). */
export async function gerarHashDeSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(String(senha), sal, TAMANHO, PARAMETROS);
  const { N, r, p } = PARAMETROS;
  return [
    'scrypt',
    N,
    r,
    p,
    sal.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/** Compara em tempo constante. */
export async function conferirSenha(
  senha: string,
  guardado: string,
): Promise<boolean> {
  const [alg, N, r, p, sal, hash] = String(guardado).split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  // Hash vazio ou corrompido nunca confere: dois buffers vazios seriam
  // "iguais" para o timingSafeEqual (issue #33).
  if (!esperado.length) return false;
  const obtido = await scryptAsync(
    String(senha),
    Buffer.from(sal, 'base64'),
    esperado.length,
    {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    },
  );
  return timingSafeEqual(esperado, obtido);
}

export const SENHA_MINIMA = 8;

/**
 * Hash de mesmo custo para conferir quando o e-mail não existe: o login leva o
 * mesmo tempo nos dois casos e não revela quais e-mails têm conta (ADR 0014).
 */
let falso: Promise<string> | undefined;
export const hashFalso = (): Promise<string> =>
  (falso ??= gerarHashDeSenha(randomBytes(32).toString('hex')));
