import { permissoesInvalidas } from '@barbertime/dominio';
import {
  conflito,
  invalido,
  naoEncontrado,
  proibido,
} from '../../infra/erros.js';

const LISTAR = `
  select p.id, p.chave, p.nome, p.protegido, p.permissoes,
         (select count(*)::int from vinculos v where v.papel_id = p.id) as usuarios
    from papeis p`;

function validar({ nome, permissoes }) {
  if (!String(nome ?? '').trim()) throw invalido('Informe o nome do papel.');
  if (!Array.isArray(permissoes))
    throw invalido('Informe as permissões do papel.');
  const ruins = permissoesInvalidas(permissoes);
  if (ruins.length)
    throw invalido(`Permissões desconhecidas: ${ruins.join(', ')}.`);
}

async function exigirEditavel(c, id) {
  const {
    rows: [papel],
  } = await c.query(`${LISTAR} where p.id = $1`, [id]);
  if (!papel) throw naoEncontrado('Papel não encontrado.');
  if (papel.protegido)
    throw proibido(`O papel ${papel.nome} não pode ser alterado.`);
  return papel;
}

const nomeRepetido = (erro) =>
  erro.code === '23505' ? conflito('Já existe um papel com esse nome.') : erro;

export default async function (fastify) {
  const gerenciar = { preHandler: fastify.exigir('papeis.gerenciar') };

  // Ler papéis também serve a quem convida usuários.
  fastify.get(
    '/papeis',
    {
      preHandler: fastify.exigirAlguma(
        'papeis.gerenciar',
        'usuarios.gerenciar',
      ),
    },
    (req) =>
      fastify.naBarbearia(
        req,
        async (c) => (await c.query(`${LISTAR} order by p.id`)).rows,
      ),
  );

  fastify.post('/papeis', gerenciar, async (req, reply) => {
    validar(req.body ?? {});
    const { nome, permissoes } = req.body;
    return fastify
      .naBarbearia(req, async (c) => {
        const {
          rows: [novo],
        } = await c.query(
          'insert into papeis (barbearia_id, nome, permissoes) values ($1, $2, $3) returning id',
          [req.contexto.barbeariaId, nome.trim(), [...new Set(permissoes)]],
        );
        reply.code(201);
        return (await c.query(`${LISTAR} where p.id = $1`, [novo.id])).rows[0];
      })
      .catch((e) => Promise.reject(nomeRepetido(e)));
  });

  fastify.put('/papeis/:id', gerenciar, async (req) => {
    validar(req.body ?? {});
    const id = Number(req.params.id);
    return fastify
      .naBarbearia(req, async (c) => {
        await exigirEditavel(c, id);
        await c.query(
          'update papeis set nome = $2, permissoes = $3 where id = $1',
          [id, req.body.nome.trim(), [...new Set(req.body.permissoes)]],
        );
        return (await c.query(`${LISTAR} where p.id = $1`, [id])).rows[0];
      })
      .catch((e) => Promise.reject(nomeRepetido(e)));
  });

  fastify.delete('/papeis/:id', gerenciar, async (req, reply) => {
    const id = Number(req.params.id);
    await fastify.naBarbearia(req, async (c) => {
      const papel = await exigirEditavel(c, id);
      if (papel.usuarios) {
        throw conflito(
          `O papel ${papel.nome} está em uso por ${papel.usuarios} usuário(s). Troque o papel deles antes.`,
        );
      }
      await c.query('delete from papeis where id = $1', [id]);
    });
    reply.code(204);
  });
}
