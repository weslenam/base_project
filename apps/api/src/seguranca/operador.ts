import { createHash, randomBytes } from 'node:crypto';
import fp from 'fastify-plugin';
import { config } from '../infra/config.ts';
import { naoAutenticado } from '../infra/erros.ts';
import type { ExecutorSql } from '../infra/banco.ts';

// Sessão dos operadores do Business Center (planejamento 0028, ADR 0018).
// Identidade separada da dos usuários de barbearia: cookie próprio, restrito ao
// caminho /api/plataforma, e tabela própria. Prazo fixo de 8h, sem renovação.

export const COOKIE_OPERADOR = 'bt_operador';
export const CAMINHO_DO_COOKIE = '/api/plataforma';
export const HORAS_DE_SESSAO = 8;

const hash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export async function criarSessaoDeOperador(
  db: ExecutorSql,
  operadorId: number,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    'insert into sessoes_operador (id_hash, operador_id, expira_em) values ($1, $2, $3)',
    [
      hash(token),
      operadorId,
      new Date(Date.now() + HORAS_DE_SESSAO * 3_600_000),
    ],
  );
  return token;
}

export const encerrarSessaoDeOperador = (
  db: ExecutorSql,
  token: string | null | undefined,
) =>
  db.query('delete from sessoes_operador where id_hash = $1', [
    hash(token ?? ''),
  ]);

export const opcoesDoCookieDeOperador = () => ({
  path: CAMINHO_DO_COOKIE,
  httpOnly: true,
  sameSite: 'strict',
  secure: config.producao,
  maxAge: HORAS_DE_SESSAO * 3_600,
});

/**
 * Plugin: req.operador (ou null) e fastify.operadorAutenticado (preHandler).
 * Registrado só dentro do escopo /api/plataforma.
 */
export default fp(async function operador(fastify) {
  fastify.decorateRequest('operador', null);

  fastify.addHook('onRequest', async (req) => {
    const token = req.cookies[COOKIE_OPERADOR];
    if (!token) return;
    const {
      rows: [op],
    } = await fastify.db.query(
      `select o.id, o.nome, o.email from sessoes_operador s
         join operadores o on o.id = s.operador_id
        where s.id_hash = $1 and s.expira_em > now() and o.ativo`,
      [hash(token)],
    );
    req.operador = op ? { ...op, token } : null;
  });

  fastify.decorate('operadorAutenticado', async (req) => {
    if (!req.operador) throw naoAutenticado();
  });
});
