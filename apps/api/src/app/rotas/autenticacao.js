import {
  conferirSenha,
  gerarHashDeSenha,
  SENHA_MINIMA,
} from '../../seguranca/senha.js';
import {
  COOKIE,
  criarSessao,
  encerrarOutrasSessoes,
  encerrarSessao,
  opcoesDoCookie,
  trocarBarbeariaDaSessao,
} from '../../seguranca/sessao.js';
import { invalido, naoAutenticado, proibido } from '../../infra/erros.js';
import { criarBarbearia } from '../../servicos/barbearias.js';

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
  /** Entrar: e-mail e senha. Abre na barbearia pedida ou na primeira do usuário. */
  fastify.post('/auth/entrar', async (req, reply) => {
    const { email, senha, barbeariaId } = req.body ?? {};
    const {
      rows: [usuario],
    } = await fastify.db.query(
      'select id, senha_hash from usuarios where lower(email) = lower($1)',
      [String(email ?? '')],
    );
    // Mesma resposta para e-mail inexistente e senha errada.
    if (!usuario || !(await conferirSenha(senha, usuario.senha_hash))) {
      throw naoAutenticado('E-mail ou senha incorretos.');
    }
    const { rows: barbearias } = await fastify.db.query(
      'select barbearia_id as id from barbearias_do_usuario($1)',
      [usuario.id],
    );
    if (!barbearias.length)
      throw proibido('Seu acesso não está ativo em nenhuma barbearia.');
    const escolhida =
      barbearias.find((b) => b.id === Number(barbeariaId)) ?? barbearias[0];

    const token = await criarSessao(fastify.db, usuario.id, escolhida.id);
    reply.setCookie(COOKIE, token, opcoesDoCookie());
    req.sessao = { usuarioId: usuario.id, barbeariaId: escolhida.id, token };
    return dadosDaSessao(fastify, req);
  });

  fastify.post('/auth/sair', async (req, reply) => {
    await encerrarSessao(fastify.db, req.sessao?.token);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  /** Quem sou eu: usuário, barbearia atual, papel, permissões e módulos ativos. */
  fastify.get('/auth/eu', async (req) => dadosDaSessao(fastify, req));

  /** Trocar de barbearia (usuário com acesso a mais de uma). */
  fastify.post('/auth/barbearia', async (req) => {
    if (!req.sessao) throw naoAutenticado();
    const id = Number(req.body?.barbeariaId);
    const { rows } = await fastify.db.query(
      'select 1 from barbearias_do_usuario($1) where barbearia_id = $2',
      [req.sessao.usuarioId, id],
    );
    if (!rows.length) throw proibido('Você não tem acesso a essa barbearia.');
    await trocarBarbeariaDaSessao(fastify.db, req.sessao.token, id);
    req.sessao.barbeariaId = id;
    req.contexto = null;
    return dadosDaSessao(fastify, req);
  });

  /** Meu perfil: o próprio usuário troca o nome. */
  fastify.put('/auth/perfil', async (req) => {
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
  });

  /**
   * Trocar a própria senha: exige a atual. As outras sessões abertas caem
   * (ex.: celular esquecido logado); a atual continua.
   */
  fastify.put('/auth/senha', async (req) => {
    await fastify.autenticado(req);
    const { senhaAtual, novaSenha } = req.body ?? {};
    const { usuarioId } = req.contexto;
    const {
      rows: [usuario],
    } = await fastify.db.query(
      'select senha_hash from usuarios where id = $1',
      [usuarioId],
    );
    if (!(await conferirSenha(String(senhaAtual ?? ''), usuario.senha_hash))) {
      throw invalido('A senha atual não confere.');
    }
    if (String(novaSenha ?? '').length < SENHA_MINIMA) {
      throw invalido(
        `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
      );
    }
    if (novaSenha === senhaAtual) {
      throw invalido('A nova senha precisa ser diferente da atual.');
    }
    await fastify.db.query(
      'update usuarios set senha_hash = $2 where id = $1',
      [usuarioId, await gerarHashDeSenha(novaSenha)],
    );
    const encerradas = await encerrarOutrasSessoes(
      fastify.db,
      usuarioId,
      req.sessao.token,
    );
    return { ok: true, sessoesEncerradas: encerradas };
  });

  /** Cadastro self-service da barbearia (público). Já entra como Dono. */
  fastify.post('/barbearias', async (req, reply) => {
    const { barbearia, usuarioId } = await criarBarbearia(
      fastify,
      req.body ?? {},
    );
    const token = await criarSessao(fastify.db, usuarioId, barbearia.id);
    reply.setCookie(COOKIE, token, opcoesDoCookie());
    req.sessao = { usuarioId, barbeariaId: barbearia.id, token };
    reply.code(201);
    return dadosDaSessao(fastify, req);
  });
}
