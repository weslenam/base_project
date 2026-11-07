import {
  conflito,
  invalido,
  naoEncontrado,
  proibido,
} from '../../infra/erros.js';
import { gerarHashDeSenha } from '../../seguranca/senha.js';
import { validarNovoUsuario } from '../../servicos/barbearias.js';

const LISTAR = `
  select u.id, u.nome, u.email, v.ativo, p.id as "papelId", p.nome as "papelNome",
         p.chave = 'dono' as dono
    from vinculos v
    join usuarios u on u.id = v.usuario_id
    join papeis p on p.id = v.papel_id`;

/** A barbearia nunca fica sem um Dono ativo (ADR 0010). */
async function garantirDono(c, { removendoUsuario }) {
  const { rows } = await c.query(
    `select count(*)::int as n from vinculos v join papeis p on p.id = v.papel_id
      where p.chave = 'dono' and v.ativo and v.usuario_id <> $1`,
    [removendoUsuario],
  );
  if (!rows[0].n)
    throw conflito('A barbearia precisa de pelo menos um Dono ativo.');
}

export default async function (fastify) {
  const acesso = { preHandler: fastify.exigir('usuarios.gerenciar') };

  fastify.get('/usuarios', acesso, (req) =>
    fastify.naBarbearia(
      req,
      async (c) => (await c.query(`${LISTAR} order by u.nome`)).rows,
    ),
  );

  /** Convida: cria a conta (com senha provisória) ou vincula conta existente pelo e-mail. */
  fastify.post('/usuarios', acesso, async (req, reply) => {
    const { nome, email, senha, papelId } = req.body ?? {};
    return fastify.naBarbearia(req, async (c) => {
      const papel = await c.query('select id from papeis where id = $1', [
        Number(papelId),
      ]);
      if (!papel.rowCount) throw invalido('Escolha o papel do usuário.');

      let {
        rows: [usuario],
      } = await c.query(
        'select id from usuarios where lower(email) = lower($1)',
        [String(email ?? '')],
      );
      if (!usuario) {
        validarNovoUsuario({ nome, email, senha });
        ({
          rows: [usuario],
        } = await c.query(
          'insert into usuarios (nome, email, senha_hash) values ($1, $2, $3) returning id',
          [nome.trim(), email.trim(), await gerarHashDeSenha(senha)],
        ));
      }
      const ja = await c.query('select 1 from vinculos where usuario_id = $1', [
        usuario.id,
      ]);
      if (ja.rowCount)
        throw conflito('Esse e-mail já tem acesso a esta barbearia.');
      await c.query(
        'insert into vinculos (barbearia_id, usuario_id, papel_id) values ($1, $2, $3)',
        [req.contexto.barbeariaId, usuario.id, Number(papelId)],
      );
      reply.code(201);
      return (await c.query(`${LISTAR} where u.id = $1`, [usuario.id])).rows[0];
    });
  });

  /** Troca papel ou ativa/desativa o acesso. */
  fastify.put('/usuarios/:id', acesso, async (req) => {
    const id = Number(req.params.id);
    if (id === req.contexto.usuarioId)
      throw proibido('Você não pode alterar o próprio acesso.');
    const { papelId, ativo } = req.body ?? {};
    return fastify.naBarbearia(req, async (c) => {
      const {
        rows: [atual],
      } = await c.query(`${LISTAR} where u.id = $1`, [id]);
      if (!atual)
        throw naoEncontrado('Usuário não encontrado nesta barbearia.');
      const novoPapel = papelId ? Number(papelId) : atual.papelId;
      const {
        rows: [papel],
      } = await c.query('select chave from papeis where id = $1', [novoPapel]);
      if (!papel) throw invalido('Papel não encontrado.');
      const deixaDeSerDonoAtivo =
        atual.dono &&
        atual.ativo &&
        (papel.chave !== 'dono' || ativo === false);
      if (deixaDeSerDonoAtivo) await garantirDono(c, { removendoUsuario: id });
      await c.query(
        'update vinculos set papel_id = $2, ativo = $3 where usuario_id = $1',
        [id, novoPapel, ativo ?? atual.ativo],
      );
      return (await c.query(`${LISTAR} where u.id = $1`, [id])).rows[0];
    });
  });

  /** Remove o acesso à barbearia (a conta do usuário continua existindo). */
  fastify.delete('/usuarios/:id', acesso, async (req, reply) => {
    const id = Number(req.params.id);
    if (id === req.contexto.usuarioId)
      throw proibido('Você não pode remover o próprio acesso.');
    await fastify.naBarbearia(req, async (c) => {
      const {
        rows: [atual],
      } = await c.query(`${LISTAR} where u.id = $1`, [id]);
      if (!atual)
        throw naoEncontrado('Usuário não encontrado nesta barbearia.');
      if (atual.dono && atual.ativo)
        await garantirDono(c, { removendoUsuario: id });
      await c.query('delete from vinculos where usuario_id = $1', [id]);
    });
    reply.code(204);
  });
}
