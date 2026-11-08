import { resumoDeComandas } from '@barbertime/dominio';
import { invalido, naoEncontrado } from '../../infra/erros.js';
import { buscarAtendimento } from '../../servicos/agenda.js';
import {
  SELECT_COMANDA,
  abrirCaixa,
  caixaComResumo,
  caixaDoDia,
  cancelarComanda,
  comandaDoAtendimento,
  comandasDoCaixa,
  completarComanda,
  fecharCaixa,
  obterComanda,
  receberComanda,
  salvarComanda,
} from '../../servicos/caixa.js';

// Caixa do dia e comandas (planejamento 0020, fase 1) + resumo e comandas do
// cliente (planejamento 0016), agora pelo banco.

export default async function (fastify) {
  const operar = { preHandler: fastify.exigir('caixa.operar') };
  const fechar = { preHandler: fastify.exigir('caixa.fechar') };
  const verCliente = {
    preHandler: fastify.exigirAlguma('clientes.ver', 'caixa.operar'),
  };
  const na = (req, fn) => fastify.naBarbearia(req, fn);
  const barbearia = (req) => req.contexto.barbeariaId;

  fastify.get('/caixa', operar, (req) =>
    na(req, async (c) => caixaComResumo(c, await caixaDoDia(c))),
  );
  fastify.post('/caixa/abrir', operar, (req) =>
    na(req, (c) => abrirCaixa(c, barbearia(req), req.body ?? {})),
  );
  fastify.post('/caixa/fechar', fechar, (req) =>
    na(req, (c) => fecharCaixa(c, req.body ?? {})),
  );

  fastify.get('/comandas', operar, (req) =>
    na(req, async (c) => {
      const caixa = await caixaDoDia(c);
      return caixa ? comandasDoCaixa(c, caixa.id) : [];
    }),
  );
  fastify.get('/comandas/:id', operar, (req) =>
    na(req, (c) => obterComanda(c, req.params.id)),
  );
  fastify.post('/comandas', operar, async (req, reply) => {
    reply.code(201);
    return na(req, (c) => salvarComanda(c, barbearia(req), req.body ?? {}));
  });
  fastify.put('/comandas/:id', operar, (req) =>
    na(req, (c) =>
      salvarComanda(c, barbearia(req), {
        ...req.body,
        id: Number(req.params.id),
      }),
    ),
  );
  fastify.post('/comandas/:id/receber', operar, (req) =>
    na(req, (c) => receberComanda(c, req.params.id, req.body ?? {})),
  );
  fastify.post('/comandas/:id/cancelar', operar, (req) =>
    na(req, (c) => cancelarComanda(c, req.params.id)),
  );
  /** "Abrir comanda" no detalhe do agendamento. */
  fastify.post('/comandas/do-atendimento/:id', operar, (req) =>
    na(req, async (c) => {
      const a = await buscarAtendimento(c, req.params.id);
      if (
        ![
          'agendado',
          'chegou',
          'em_atendimento',
          'finalizado',
          'na_fila',
        ].includes(a.status)
      )
        throw invalido('Só dá para abrir comanda de atendimento em andamento.');
      if (a.status === 'agendado' && !a.confirmadoEm)
        throw invalido(
          'Só dá para abrir comanda de agendamento confirmado ou atendido.',
        );
      return comandaDoAtendimento(c, barbearia(req), a);
    }),
  );

  // ---- cliente (planejamento 0016) ----
  async function comandasDoCliente(c, id) {
    const existe = await c.query('select 1 from clientes where id = $1', [
      Number(id),
    ]);
    if (!existe.rowCount) throw naoEncontrado('Cliente não encontrado.');
    const { rows } = await c.query(
      `${SELECT_COMANDA} where cm.cliente_id = $1 order by cx.data desc, cm.hora desc, cm.id desc`,
      [Number(id)],
    );
    return rows.map(completarComanda);
  }

  fastify.get('/clientes/:id/resumo', verCliente, (req) =>
    na(req, async (c) => {
      const comandas = await comandasDoCliente(c, req.params.id);
      const r = resumoDeComandas(comandas);
      const {
        rows: [{ faltas }],
      } = await c.query(
        "select count(*)::int as faltas from atendimentos where cliente_id = $1 and estado = 'no_show'",
        [Number(req.params.id)],
      );
      let barbeiroNome = '';
      if (r.ultimoServico?.barbeiroId) {
        const b = await c.query('select nome from barbeiros where id = $1', [
          r.ultimoServico.barbeiroId,
        ]);
        barbeiroNome = b.rows[0]?.nome ?? '';
      }
      return {
        ...r,
        faltas,
        ultimoServico: r.ultimoServico && { ...r.ultimoServico, barbeiroNome },
      };
    }),
  );

  fastify.get('/clientes/:id/comandas', verCliente, (req) =>
    na(req, async (c) => {
      const limite = Math.min(50, Number(req.query.limite) || 5);
      const deslocamento = Math.max(0, Number(req.query.deslocamento) || 0);
      const todas = (await comandasDoCliente(c, req.params.id)).filter(
        (x) => x.estado !== 'cancelada',
      );
      return {
        total: todas.length,
        itens: todas.slice(deslocamento, deslocamento + limite),
      };
    }),
  );
}
