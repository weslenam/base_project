import { conflito, invalido, naoEncontrado } from '../../infra/erros.js';
import { SELECT_ATENDIMENTO, agora, comEstado } from '../../servicos/agenda.js';
import { TAM, corpo, query, texto } from '../esquemas.js';

// Clientes da barbearia (planejamento 0019).

const formatarTelefone = (t) =>
  t.length === 11
    ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`
    : `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;

/** Cliente com o resumo de atendimentos (contagens e última visita). */
const SELECT_CLIENTE = `
  select c.id, c.nome, c.telefone, c.cpf, c.observacoes,
         (select count(*)::int from atendimentos a where a.cliente_id = c.id and a.estado in ('finalizado', 'pago')) as atendimentos,
         (select count(*)::int from atendimentos a where a.cliente_id = c.id and a.estado = 'no_show') as faltas,
         (select max(a.data) from atendimentos a where a.cliente_id = c.id and a.estado in ('finalizado', 'pago')) as "ultimaVisita"
    from clientes c`;

export default async function (fastify) {
  const ver = {
    preHandler: fastify.exigirAlguma(
      'clientes.ver',
      'agenda.gerenciar',
      'caixa.operar',
    ),
  };
  const editar = {
    preHandler: fastify.exigirAlguma(
      'clientes.editar',
      'agenda.gerenciar',
      'caixa.operar',
    ),
  };
  const excluir = { preHandler: fastify.exigir('clientes.excluir') };
  const cliente = {
    ...editar,
    schema: corpo({
      nome: texto(TAM.nome),
      telefone: texto(TAM.telefone),
      cpf: texto(TAM.cpf),
      observacoes: texto(TAM.observacao),
    }),
  };
  const na = (req, fn) => fastify.naBarbearia(req, fn);

  async function obter(c, id) {
    const {
      rows: [cliente],
    } = await c.query(`${SELECT_CLIENTE} where c.id = $1`, [Number(id)]);
    if (!cliente) throw naoEncontrado('Cliente não encontrado.');
    return cliente;
  }

  /** busca: parte do nome ou dos dígitos do telefone. */
  fastify.get(
    '/clientes',
    { ...ver, schema: query({ busca: texto(TAM.nome) }) },
    (req) =>
      na(req, async (c) => {
        const busca = String(req.query.busca ?? '').trim();
        const digitos = busca.replace(/\D/g, '');
        const { rows } = await c.query(
          `${SELECT_CLIENTE}
          where $1 = '' or c.nome ilike '%' || $1 || '%' or ($2 <> '' and c.telefone like '%' || $2 || '%')
          limit 500`,
          [busca, digitos],
        );
        return rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      }),
  );

  fastify.get('/clientes/:id', ver, (req) =>
    na(req, (c) => obter(c, req.params.id)),
  );

  fastify.get('/clientes/:id/historico', ver, (req) =>
    na(req, async (c) => {
      await obter(c, req.params.id);
      return (
        await c.query(
          `${SELECT_ATENDIMENTO} where a.cliente_id = $1 order by a.data desc, a.inicio desc nulls last`,
          [Number(req.params.id)],
        )
      ).rows.map(comEstado);
    }),
  );

  const salvar = (req) =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      const telefone = String(d.telefone ?? '').replace(/\D/g, '');
      if (!nome) throw invalido('Informe o nome do cliente.');
      if (!telefone) throw invalido('Informe o telefone do cliente.');
      if (!/^\d{10,11}$/.test(telefone))
        throw invalido('Telefone inválido: use DDD + número.');
      const {
        rows: [dono],
      } = await c.query(
        'select nome from clientes where telefone = $1 and id <> coalesce($2::bigint, 0)',
        [telefone, id],
      );
      if (dono)
        throw conflito(
          `O telefone ${formatarTelefone(telefone)} já está no cadastro de ${dono.nome}.`,
        );
      const valores = [
        nome,
        telefone,
        String(d.cpf ?? '').replace(/\D/g, '') || null,
        String(d.observacoes ?? '').trim(),
      ];
      if (id) {
        await obter(c, id);
        await c.query(
          'update clientes set nome = $2, telefone = $3, cpf = $4, observacoes = $5 where id = $1',
          [id, ...valores],
        );
        return obter(c, id);
      }
      const {
        rows: [novo],
      } = await c.query(
        `insert into clientes (barbearia_id, nome, telefone, cpf, observacoes)
         values ($1, $2, $3, $4, $5) returning id`,
        [req.contexto.barbeariaId, ...valores],
      );
      return obter(c, novo.id);
    });
  fastify.post('/clientes', cliente, async (req, reply) => {
    reply.code(201);
    return salvar(req);
  });
  fastify.put('/clientes/:id', cliente, salvar);

  fastify.delete('/clientes/:id', excluir, async (req, reply) => {
    await na(req, async (c) => {
      const cliente = await obter(c, req.params.id);
      const { rows } = await c.query(
        "select count(*)::int as n from atendimentos where cliente_id = $1 and data >= $2 and estado in ('agendado', 'chegou', 'na_fila', 'em_atendimento')",
        [cliente.id, agora().data],
      );
      const n = rows[0].n;
      if (n)
        throw conflito(
          `Não é possível excluir "${cliente.nome}": há ${n} agendamento${n > 1 ? 's' : ''} futuro${n > 1 ? 's' : ''}. Cancele ou remarque antes.`,
        );
      await c.query('delete from clientes where id = $1', [cliente.id]);
    });
    reply.code(204);
  });
}
