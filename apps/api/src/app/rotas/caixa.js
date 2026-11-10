import { resumoDeComandas } from '@barbertime/dominio';
import { invalido, naoEncontrado } from '../../infra/erros.ts';
import { buscarAtendimento } from '../../servicos/agenda.ts';
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
import {
  corpo,
  escalar,
  inteiro,
  itensDeComanda,
  logico,
  query,
  texto,
} from '../esquemas.ts';

// Caixa do dia e comandas (planejamento 0020, fase 1) + resumo e comandas do
// cliente (planejamento 0016), agora pelo banco.

export default async function (fastify) {
  const operar = { preHandler: fastify.exigir('caixa.operar') };
  const fechar = { preHandler: fastify.exigir('caixa.fechar') };
  const comanda = {
    ...operar,
    schema: corpo({
      id: inteiro,
      atendimentoId: inteiro,
      barbeiroId: inteiro,
      clienteId: inteiro,
      itens: itensDeComanda,
      desconto: escalar(),
      forma: texto(30),
      premioFidelidade: logico,
      cashbackUsado: escalar(),
    }),
  };
  // Resgate e crédito da fidelidade só com o módulo ativo (ADR 0011).
  const fidelidade = (req) => ({
    ativo: req.contexto.modulosAtivos.includes('fidelidade'),
  });
  // Usar pacote na comanda (e vender) só com o módulo ativo (planejamento 0034).
  const pacotes = (req) => ({
    ativo: req.contexto.modulosAtivos.includes('pacotes'),
  });
  const verCliente = {
    preHandler: fastify.exigirAlguma('clientes.ver', 'caixa.operar'),
  };
  const na = (req, fn) => fastify.naBarbearia(req, fn);
  const barbearia = (req) => req.contexto.barbeariaId;

  fastify.get('/caixa', operar, (req) =>
    na(req, async (c) => caixaComResumo(c, await caixaDoDia(c))),
  );
  fastify.post(
    '/caixa/abrir',
    // Abrir o caixa tem permissão própria: o Barbeiro opera, mas não abre
    // (planejamento 0039).
    {
      preHandler: fastify.exigir('caixa.abrir'),
      schema: corpo({ valorInicial: escalar() }),
    },
    (req) => na(req, (c) => abrirCaixa(c, barbearia(req), req.body ?? {})),
  );
  fastify.post(
    '/caixa/fechar',
    { ...fechar, schema: corpo({ dinheiroContado: escalar() }) },
    (req) => na(req, (c) => fecharCaixa(c, req.body ?? {})),
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
  fastify.post('/comandas', comanda, async (req, reply) => {
    reply.code(201);
    return na(req, (c) =>
      salvarComanda(c, barbearia(req), req.body ?? {}, {
        fidelidade: fidelidade(req),
        pacotes: pacotes(req),
      }),
    );
  });
  fastify.put('/comandas/:id', comanda, (req) =>
    na(req, (c) =>
      salvarComanda(
        c,
        barbearia(req),
        { ...req.body, id: Number(req.params.id) },
        { fidelidade: fidelidade(req), pacotes: pacotes(req) },
      ),
    ),
  );
  fastify.post(
    '/comandas/:id/receber',
    { ...operar, schema: corpo({ forma: texto(30) }) },
    (req) =>
      na(req, (c) =>
        receberComanda(c, req.params.id, req.body ?? {}, {
          barbeariaId: barbearia(req),
          usuarioId: req.contexto.usuarioId,
          fidelidade: fidelidade(req),
        }),
      ),
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

  fastify.get(
    '/clientes/:id/comandas',
    {
      ...verCliente,
      schema: query({ limite: escalar(), deslocamento: escalar() }),
    },
    (req) =>
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
