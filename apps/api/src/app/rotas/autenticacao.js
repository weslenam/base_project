import { chaves } from '../../seguranca/limites.ts';
import { corpo, inteiro, TAM, texto } from '../esquemas.ts';
import { invalido, naoAutenticado, proibido } from '../../infra/erros.ts';
import { criarBarbearia } from '../../servicos/barbearias.js';
import { BARBEARIA_SUSPENSA } from '../../seguranca/autenticacao.ts';

async function dadosDaSessao(fastify, req) {
  await fastify.autenticado(req);
  const { usuarioId, barbeariaId, papel, permissoes, modulosAtivos } =
    req.contexto;
  const [
    {
      rows: [usuario],
    },
    { rows: barbearias },
  ] = await Promise.all([
    fastify.db.query('select id, nome, email from usuarios where id = $1', [
      usuarioId,
    ]),
    fastify.db.query(
      'select barbearia_id as id, nome, slug from barbearias_do_usuario($1)',
      [usuarioId],
    ),
  ]);
  return {
    usuario,
    barbearia: barbearias.find((b) => b.id === barbeariaId),
    barbearias,
    papel,
    permissoes,
    modulosAtivos,
  };
}

export default async function (fastify) {
  // Sessão, senha e credenciais ficam na identidade (ADR 0016, planejamento 0025 S3).
  const identidade = fastify.identidade;

  /**
   * Entrar: e-mail e senha. Abre na barbearia pedida ou na primeira do usuário.
   * Limite por IP e por e-mail (força bruta distribuída contra uma conta).
   */
  const entrar = {
    schema: corpo({
      email: texto(TAM.email),
      senha: texto(TAM.senha),
      barbeariaId: inteiro,
    }),
    preHandler: [
      fastify.limitar('entrarPorIp', chaves.ip),
      fastify.limitar('entrarPorEmail', chaves.email),
    ],
  };
  fastify.post('/auth/entrar', entrar, async (req, reply) => {
    const { email, senha, barbeariaId } = req.body ?? {};
    // Mesma resposta e o mesmo tempo para e-mail inexistente e senha errada (ADR 0014).
    const usuarioId = await identidade.conferirCredenciais(email, senha);
    if (!usuarioId) {
      throw naoAutenticado('E-mail ou senha incorretos.');
    }
    const { rows: barbearias } = await fastify.db.query(
      'select barbearia_id as id from barbearias_do_usuario($1)',
      [usuarioId],
    );
    if (!barbearias.length) {
      // A função só lista barbearias não suspensas (planejamento 0028).
      const {
        rows: [{ suspensa }],
      } = await fastify.db.query(
        'select usuario_em_barbearia_suspensa($1) as suspensa',
        [usuarioId],
      );
      throw proibido(
        suspensa
          ? BARBEARIA_SUSPENSA
          : 'Seu acesso não está ativo em nenhuma barbearia.',
      );
    }
    const escolhida =
      barbearias.find((b) => b.id === Number(barbeariaId)) ?? barbearias[0];

    req.sessao = await identidade.abrirSessao(reply, usuarioId, escolhida.id);
    return dadosDaSessao(fastify, req);
  });

  fastify.post('/auth/sair', async (req, reply) => {
    await identidade.sair(req, reply);
    return { ok: true };
  });

  /** Quem sou eu: usuário, barbearia atual, papel, permissões e módulos ativos. */
  fastify.get('/auth/eu', async (req) => dadosDaSessao(fastify, req));

  /** Trocar de barbearia (usuário com acesso a mais de uma). */
  fastify.post(
    '/auth/barbearia',
    { schema: corpo({ barbeariaId: inteiro }) },
    async (req) => {
      if (!req.sessao) throw naoAutenticado();
      const id = Number(req.body?.barbeariaId);
      const { rows } = await fastify.db.query(
        'select 1 from barbearias_do_usuario($1) where barbearia_id = $2',
        [req.sessao.usuarioId, id],
      );
      if (!rows.length) throw proibido('Você não tem acesso a essa barbearia.');
      await identidade.trocarBarbearia(req.sessao, id);
      req.sessao.barbeariaId = id;
      req.contexto = null;
      return dadosDaSessao(fastify, req);
    },
  );

  /** Meu perfil: o próprio usuário troca o nome. */
  fastify.put(
    '/auth/perfil',
    { schema: corpo({ nome: texto(500) }) },
    async (req) => {
      await fastify.autenticado(req);
      const nome = String(req.body?.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome.');
      if (nome.length > 120)
        throw invalido('O nome pode ter até 120 caracteres.');
      await fastify.db.query('update usuarios set nome = $2 where id = $1', [
        req.contexto.usuarioId,
        nome,
      ]);
      return dadosDaSessao(fastify, req);
    },
  );

  /**
   * Trocar a própria senha: exige a atual. As outras sessões abertas caem
   * (ex.: celular esquecido logado); a atual continua.
   */
  const trocarSenha = {
    schema: corpo({
      senhaAtual: texto(TAM.senha),
      novaSenha: texto(TAM.senha),
    }),
    preHandler: fastify.limitar('senhaPorIp', chaves.ip),
  };
  fastify.put('/auth/senha', trocarSenha, async (req) => {
    await fastify.autenticado(req);
    const { senhaAtual, novaSenha } = req.body ?? {};
    const encerradas = await identidade.trocarSenha(
      req.sessao,
      senhaAtual,
      novaSenha,
    );
    return { ok: true, sessoesEncerradas: encerradas };
  });

  /** Cadastro self-service da barbearia (público). Já entra como Dono. */
  const cadastro = {
    schema: corpo({
      nome: texto(TAM.nome),
      slug: texto(TAM.slug),
      dono: {
        type: ['object', 'null'],
        properties: {
          nome: texto(TAM.nome),
          email: texto(TAM.email),
          senha: texto(TAM.senha),
        },
      },
    }),
    preHandler: fastify.limitar('cadastroPorIp', chaves.ip),
  };
  fastify.post('/barbearias', cadastro, async (req, reply) => {
    const { barbearia, usuarioId } = await criarBarbearia(
      fastify,
      req.body ?? {},
    );
    req.sessao = await identidade.abrirSessao(reply, usuarioId, barbearia.id);
    reply.code(201);
    return dadosDaSessao(fastify, req);
  });
}
