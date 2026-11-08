import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { permissoesDoPapel, permissoesEfetivas } from '@barbertime/dominio';
import { naoAutenticado, proibido } from '../infra/erros.js';
import { COOKIE, lerSessao } from './sessao.js';

export const BARBEARIA_SUSPENSA =
  'Esta barbearia está suspensa. Fale com o suporte do BarberTime.';

/**
 * Sessão e autorização (ADRs 0009, 0010, 0011).
 *  - fastify.autenticado: exige sessão e carrega o contexto da barbearia
 *  - fastify.exigir(...permissoes): todas as permissões
 *  - fastify.exigirAlguma(...permissoes): ao menos uma
 *  - fastify.exigirModulo(chave): módulo ativo na barbearia
 * O contexto (papel, permissões efetivas, módulos ativos) é lido uma vez por requisição.
 */
export default fp(async function autenticacao(fastify) {
  await fastify.register(cookie);

  fastify.decorateRequest('sessao', null);
  fastify.decorateRequest('contexto', null);

  fastify.addHook('onRequest', async (req) => {
    const token = req.cookies[COOKIE];
    const sessao = token ? await lerSessao(fastify.db, token) : null;
    req.sessao = sessao ? { ...sessao, token } : null;
  });

  async function carregarContexto(req) {
    if (req.contexto) return req.contexto;
    if (!req.sessao) throw naoAutenticado();
    const { usuarioId, barbeariaId } = req.sessao;
    if (!barbeariaId) throw proibido('Escolha uma barbearia para continuar.');
    // Barbearia suspensa pelo Business Center (planejamento 0028): ninguém entra.
    const { rows: suspensa } = await fastify.db.query(
      'select 1 from barbearias where id = $1 and suspensa_em is not null',
      [barbeariaId],
    );
    if (suspensa.length) throw proibido(BARBEARIA_SUSPENSA);
    const contexto = await fastify.comBarbearia(barbeariaId, async (c) => {
      const { rows } = await c.query(
        `select p.id as "papelId", p.nome as "papelNome", p.chave
           from vinculos v join papeis p on p.id = v.papel_id
          where v.usuario_id = $1 and v.ativo`,
        [usuarioId],
      );
      if (!rows[0]) return null;
      const modulos = await c.query(
        "select modulo from barbearia_modulos where estado = 'ativo'",
      );
      const modulosAtivos = modulos.rows.map((m) => m.modulo);
      return {
        usuarioId,
        barbeariaId,
        papel: {
          id: rows[0].papelId,
          nome: rows[0].papelNome,
          chave: rows[0].chave,
        },
        modulosAtivos,
        // Permissões fixas pela chave do papel (ADR 0010): a coluna do banco
        // não é fonte de verdade, nem um dado adulterado dá acesso.
        permissoes: permissoesEfetivas(
          permissoesDoPapel(rows[0].chave),
          modulosAtivos,
        ),
      };
    });
    if (!contexto)
      throw proibido('Seu acesso a esta barbearia não está ativo.');
    req.contexto = contexto;
    return contexto;
  }

  fastify.decorate('autenticado', async (req) => {
    await carregarContexto(req);
  });

  fastify.decorate('exigir', (...permissoes) => async (req) => {
    const { permissoes: tem } = await carregarContexto(req);
    if (!permissoes.every((p) => tem.includes(p))) throw proibido();
  });

  fastify.decorate('exigirAlguma', (...permissoes) => async (req) => {
    const { permissoes: tem } = await carregarContexto(req);
    if (!permissoes.some((p) => tem.includes(p))) throw proibido();
  });

  fastify.decorate('exigirModulo', (chave) => async (req) => {
    const { modulosAtivos } = await carregarContexto(req);
    if (!modulosAtivos.includes(chave)) {
      throw proibido(`O módulo "${chave}" não está ativo nesta barbearia.`);
    }
  });

  /** Executa fn(cliente) com o RLS da barbearia da requisição. */
  fastify.decorate('naBarbearia', (req, fn) =>
    fastify.comBarbearia(req.contexto.barbeariaId, fn),
  );
});
