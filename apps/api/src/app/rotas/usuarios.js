import { podeAgirSobre } from '@barbertime/dominio';
import {
  conflito,
  invalido,
  naoEncontrado,
  proibido,
} from '../../infra/erros.js';
import { validarNovoUsuario } from '../../servicos/barbearias.js';
import { TAM, corpo, inteiro, logico, texto } from '../esquemas.js';

const LISTAR = `
  select u.id, u.nome, u.email, v.ativo, p.id as "papelId", p.nome as "papelNome",
         p.chave as "papelChave", p.chave = 'dono' as dono
    from vinculos v
    join usuarios u on u.id = v.usuario_id
    join papeis p on p.id = v.papel_id`;

/**
 * Hierarquia fixa (ADR 0010, planejamento 0023): só se age sobre quem está
 * ABAIXO, nunca acima nem na lateral. Vale para o papel dado, o papel atual do
 * alvo e o papel novo. Ninguém dá o papel Dono, e o Dono é intocável.
 * Senha de outra pessoa: não existe rota; cada um troca a sua em Meu perfil ou
 * recupera por e-mail.
 */
function exigirAbaixo(req, chaveDoAlvo, mensagem) {
  if (!podeAgirSobre(req.contexto.papel.chave, chaveDoAlvo))
    throw proibido(mensagem);
}
const SO_ABAIXO = 'Você só pode dar papéis abaixo do seu.';
const SO_QUEM_ESTA_ABAIXO =
  'Você só pode alterar o acesso de quem está abaixo de você.';

async function papelPorId(c, id) {
  const {
    rows: [papel],
  } = await c.query('select id, chave from papeis where id = $1', [id]);
  return papel ?? null;
}

export default async function (fastify) {
  const acesso = { preHandler: fastify.exigir('usuarios.gerenciar') };

  fastify.get('/usuarios', acesso, (req) =>
    fastify.naBarbearia(
      req,
      async (c) => (await c.query(`${LISTAR} order by u.nome`)).rows,
    ),
  );

  /** Convida: cria a conta (com senha inicial) ou vincula conta existente pelo e-mail. */
  fastify.post(
    '/usuarios',
    {
      ...acesso,
      schema: corpo({
        nome: texto(TAM.nome),
        email: texto(TAM.email),
        senha: texto(TAM.senha),
        papelId: inteiro,
      }),
    },
    async (req, reply) => {
      const { nome, email, senha, papelId } = req.body ?? {};
      return fastify.naBarbearia(req, async (c) => {
        const papel = await papelPorId(c, Number(papelId));
        if (!papel) throw invalido('Escolha o papel do usuário.');
        exigirAbaixo(req, papel.chave, SO_ABAIXO);

        let {
          rows: [usuario],
        } = await c.query(
          'select id from usuarios where lower(email) = lower($1)',
          [String(email ?? '')],
        );
        if (!usuario) {
          validarNovoUsuario({ nome, email, senha });
          usuario = {
            id: await fastify.identidade.criarConta(c, {
              nome: nome.trim(),
              email: email.trim(),
              senha,
            }),
          };
        }
        const ja = await c.query(
          'select 1 from vinculos where usuario_id = $1',
          [usuario.id],
        );
        if (ja.rowCount)
          throw conflito('Esse e-mail já tem acesso a esta barbearia.');
        await c.query(
          'insert into vinculos (barbearia_id, usuario_id, papel_id) values ($1, $2, $3)',
          [req.contexto.barbeariaId, usuario.id, papel.id],
        );
        reply.code(201);
        return (await c.query(`${LISTAR} where u.id = $1`, [usuario.id]))
          .rows[0];
      });
    },
  );

  /** Troca o papel ou ativa/desativa o acesso de quem está abaixo. */
  fastify.put(
    '/usuarios/:id',
    { ...acesso, schema: corpo({ papelId: inteiro, ativo: logico }) },
    async (req) => {
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
        exigirAbaixo(req, atual.papelChave, SO_QUEM_ESTA_ABAIXO);
        const papel = papelId
          ? await papelPorId(c, Number(papelId))
          : { id: atual.papelId, chave: atual.papelChave };
        if (!papel) throw invalido('Papel não encontrado.');
        exigirAbaixo(req, papel.chave, SO_ABAIXO);
        await c.query(
          'update vinculos set papel_id = $2, ativo = $3 where usuario_id = $1',
          [id, papel.id, ativo ?? atual.ativo],
        );
        return (await c.query(`${LISTAR} where u.id = $1`, [id])).rows[0];
      });
    },
  );

  /** Remove o acesso à barbearia de quem está abaixo (a conta continua existindo). */
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
      exigirAbaixo(req, atual.papelChave, SO_QUEM_ESTA_ABAIXO);
      await c.query('delete from vinculos where usuario_id = $1', [id]);
    });
    reply.code(204);
  });
}
