import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import { invalido } from '../infra/erros.ts';
import type { Correio } from '../infra/correio.ts';
import type { Identidade } from '../app/tipos-fastify.ts';
import {
  conferirSenha,
  gerarHashDeSenha,
  hashFalso,
  SENHA_MINIMA,
} from '../seguranca/senha.ts';
import {
  COOKIE,
  criarSessao,
  encerrarOutrasSessoes,
  encerrarSessao,
  lerSessao,
  opcoesDoCookie,
  trocarBarbeariaDaSessao,
} from '../seguranca/sessao.ts';

/**
 * Identidade "propria" (ADR 0016, planejamento 0025 S3): sessão opaca em cookie
 * HttpOnly, senha com scrypt e "esqueci a senha" com token próprio. É o código
 * que antes ficava nas rotas, sem mudança de comportamento.
 *
 * Contrato de toda implementação de identidade (a "supabase" entra na S4):
 * o tipo `Identidade` (app/tipos-fastify.ts).
 *  - lerSessao(req)                         → { usuarioId, barbeariaId, token } | null
 *  - abrirSessao(reply, usuarioId, barbeariaId) → sessão (e grava o cookie)
 *  - trocarBarbearia(sessao, barbeariaId)
 *  - sair(req, reply)
 *  - conferirCredenciais(email, senha)      → usuarioId | null (mesmo tempo nos dois casos)
 *  - criarConta(db, { nome, email, senha }) → usuarioId (db pode ser a transação)
 *  - trocarSenha(sessao, senhaAtual, novaSenha) → quantas outras sessões caíram
 *  - pedirRedefinicao(email, log)           → não revela se o e-mail existe
 *  - redefinirSenha(token, senha)
 *  - encerrarSessoesDaBarbearia(db, barbeariaId)
 *
 * `usuarios` e `sessoes` são tabelas globais (sem barbearia): fora de
 * transação, as consultas usam o pool com o driver pg; dentro do
 * `emTransacao`, o Kysely da transação (planejamento 0040).
 */

/** Opções da identidade (o correio e o endereço do app, para os e-mails). */
export interface OpcoesDaIdentidade {
  correio: Correio;
  appUrl: string;
}

// "Esqueci a senha" (planejamento 0023, ADRs 0010 e 0014):
//  - token de 32 bytes; só o sha256 fica no banco. Vale 1h e uma vez só; pedir
//    outro invalida os anteriores;
//  - o link leva o token no fragmento (#t=...): não vai ao servidor ao abrir a
//    página, nem para logs ou Referer;
//  - redefinir derruba todas as sessões da pessoa.
const VALIDADE_DA_REDEFINICAO_MS = 60 * 60 * 1000;
const hash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export async function criarIdentidadePropria(
  fastify: FastifyInstance,
  { correio, appUrl }: OpcoesDaIdentidade,
): Promise<Identidade> {
  const db = fastify.db;
  // Gera o hash falso já na subida: nem o primeiro login fica mais lento.
  await hashFalso();

  return {
    nome: 'propria',

    async lerSessao(req) {
      const token = req.cookies[COOKIE];
      const sessao = token ? await lerSessao(db, token) : null;
      return sessao && token ? { ...sessao, token } : null;
    },

    async abrirSessao(reply, usuarioId, barbeariaId) {
      const token = await criarSessao(db, usuarioId, barbeariaId);
      reply.setCookie(COOKIE, token, opcoesDoCookie());
      return { usuarioId, barbeariaId, token };
    },

    trocarBarbearia: (sessao, barbeariaId) =>
      trocarBarbeariaDaSessao(db, sessao.token, barbeariaId),

    async sair(req, reply) {
      await encerrarSessao(db, req.sessao?.token);
      reply.clearCookie(COOKIE, { path: '/' });
    },

    async conferirCredenciais(email, senha) {
      const {
        rows: [usuario],
      } = await db.query<{ id: number; senha_hash: string }>(
        'select id, senha_hash from usuarios where lower(email) = lower($1)',
        [String(email ?? '')],
      );
      // Mesmo tempo para e-mail inexistente e senha errada: sem usuário,
      // confere contra um hash falso de mesmo custo (ADR 0014). A senha vai
      // como texto, como sempre foi (o `conferirSenha` também faz String()).
      const confere = await conferirSenha(
        String(senha),
        usuario ? usuario.senha_hash : await hashFalso(),
      );
      return usuario && confere ? usuario.id : null;
    },

    async criarConta(c, { nome, email, senha }) {
      const {
        rows: [u],
      } = await c.query<{ id: number }>(
        'insert into usuarios (nome, email, senha_hash) values ($1, $2, $3) returning id',
        [nome, email, await gerarHashDeSenha(senha)],
      );
      if (!u) throw new Error('A conta não foi criada.');
      return u.id;
    },

    async trocarSenha(sessao, senhaAtual, novaSenha) {
      const {
        rows: [usuario],
      } = await db.query<{ senha_hash: string }>(
        'select senha_hash from usuarios where id = $1',
        [sessao.usuarioId],
      );
      // Sessão sem usuário não acontece (a sessão cai junto com a conta); se
      // acontecer, é erro interno, como antes, e nada é trocado.
      if (!usuario) throw new Error('Usuário da sessão não encontrado.');
      if (!(await conferirSenha(String(senhaAtual ?? ''), usuario.senha_hash)))
        throw invalido('A senha atual não confere.');
      const nova = String(novaSenha ?? '');
      if (nova.length < SENHA_MINIMA)
        throw invalido(
          `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
        );
      if (novaSenha === senhaAtual)
        throw invalido('A nova senha precisa ser diferente da atual.');
      await db.query('update usuarios set senha_hash = $2 where id = $1', [
        sessao.usuarioId,
        await gerarHashDeSenha(nova),
      ]);
      return encerrarOutrasSessoes(db, sessao.usuarioId, sessao.token);
    },

    async pedirRedefinicao(email, log) {
      const {
        rows: [usuario],
      } = await db.query<{ id: number; nome: string; email: string }>(
        'select id, nome, email from usuarios where lower(email) = lower($1)',
        [String(email ?? '').trim()],
      );
      if (!usuario) return;
      // Fora do caminho da resposta: gravar o token e enviar o e-mail não pode
      // deixar a resposta de quem tem conta mais lenta (o tempo não revela nada).
      const token = randomBytes(32).toString('base64url');
      setImmediate(() =>
        fastify
          .emTransacao(async (c) => {
            await c.db
              .deleteFrom('redefinicoesSenha')
              .where('usuarioId', '=', usuario.id)
              .where('usadaEm', 'is', null)
              .execute();
            await c.db
              .insertInto('redefinicoesSenha')
              .values({
                idHash: hash(token),
                usuarioId: usuario.id,
                expiraEm: new Date(Date.now() + VALIDADE_DA_REDEFINICAO_MS),
              })
              .execute();
          })
          .then(() =>
            correio.enviar({
              para: usuario.email,
              assunto: 'BarberTime: criar uma senha nova',
              texto: [
                `Olá, ${usuario.nome.trim().split(/\s+/)[0]}.`,
                '',
                'Recebemos um pedido para criar uma senha nova na sua conta do BarberTime.',
                `Abra o link abaixo (vale por 1 hora e uma vez só):`,
                '',
                `${appUrl}/redefinir-senha#t=${token}`,
                '',
                'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
              ].join('\n'),
            }),
          )
          .catch((erro: unknown) =>
            log.error(
              { err: erro },
              'falha ao preparar a redefinição de senha',
            ),
          ),
      );
    },

    async redefinirSenha(token, senha) {
      if (senha.length < SENHA_MINIMA)
        throw invalido(
          `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
        );
      const novoHash = await gerarHashDeSenha(senha);
      await fastify.emTransacao(async (c) => {
        // Uso único e atômico: marca como usado e devolve o dono numa só operação.
        const r = await c.db
          .updateTable('redefinicoesSenha')
          .set({ usadaEm: sql<Date>`now()` })
          .where('idHash', '=', hash(token))
          .where('usadaEm', 'is', null)
          .where('expiraEm', '>', sql<Date>`now()`)
          .returning('usuarioId')
          .executeTakeFirst();
        if (!r)
          throw invalido(
            'Este link é inválido ou expirou. Peça um novo em "Esqueci minha senha".',
          );
        await c.db
          .updateTable('usuarios')
          .set({ senhaHash: novoHash })
          .where('id', '=', r.usuarioId)
          .execute();
        await c.db
          .deleteFrom('redefinicoesSenha')
          .where('usuarioId', '=', r.usuarioId)
          .where('usadaEm', 'is', null)
          .execute();
        await encerrarOutrasSessoes(c, r.usuarioId);
      });
    },

    encerrarSessoesDaBarbearia: (c, barbeariaId) =>
      c.query('delete from sessoes where barbearia_id = $1', [barbeariaId]),
  };
}
