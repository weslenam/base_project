import { createHash, randomBytes } from 'node:crypto';
import { config } from '../infra/config.ts';
import type { ExecutorSql } from '../infra/banco.ts';

export const COOKIE = 'bt_sessao';
const hash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
const expiracao = () => new Date(Date.now() + config.diasDeSessao * 86_400_000);

/** Cria a sessão e devolve o token (só o hash vai para o banco). */
export async function criarSessao(
  db: ExecutorSql,
  usuarioId: number,
  barbeariaId: number | null,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    'insert into sessoes (id_hash, usuario_id, barbearia_id, expira_em) values ($1, $2, $3, $4)',
    [hash(token), usuarioId, barbeariaId, expiracao()],
  );
  return token;
}

/**
 * Sessão válida ou null. Renova a validade só quando já passou da metade do
 * prazo: assim a maioria das requisições é só leitura, sem escrita por pedido.
 */
export async function lerSessao(
  db: ExecutorSql,
  token: string | null | undefined,
): Promise<{ usuarioId: number; barbeariaId: number | null } | null> {
  if (!token) return null;
  const meioPrazo = new Date(
    Date.now() + (config.diasDeSessao * 86_400_000) / 2,
  );
  const { rows } = await db.query(
    `with sessao as (
       select usuario_id, barbearia_id from sessoes
        where id_hash = $1 and expira_em > now()
     ), renovada as (
       update sessoes set expira_em = $2
        where id_hash = $1 and expira_em > now() and expira_em < $3
     )
     select usuario_id as "usuarioId", barbearia_id as "barbeariaId" from sessao`,
    [hash(token), expiracao(), meioPrazo],
  );
  return rows[0] ?? null;
}

export const trocarBarbeariaDaSessao = (
  db: ExecutorSql,
  token: string,
  barbeariaId: number,
) =>
  db.query('update sessoes set barbearia_id = $2 where id_hash = $1', [
    hash(token),
    barbeariaId,
  ]);

export const encerrarSessao = (
  db: ExecutorSql,
  token: string | null | undefined,
) => db.query('delete from sessoes where id_hash = $1', [hash(token ?? '')]);

/** Encerra as sessões do usuário, menos a do token informado. Devolve quantas caíram. */
export async function encerrarOutrasSessoes(
  db: ExecutorSql,
  usuarioId: number,
  tokenMantido: string | null = '',
): Promise<number | null> {
  const { rowCount } = await db.query(
    'delete from sessoes where usuario_id = $1 and id_hash <> $2',
    [usuarioId, hash(tokenMantido ?? '')],
  );
  return rowCount;
}

export const opcoesDoCookie = () => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.producao,
  maxAge: config.diasDeSessao * 86_400,
});
