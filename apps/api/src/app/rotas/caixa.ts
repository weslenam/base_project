import { resumoDeComandas } from '@barbertime/dominio';
import type { Valor } from '@barbertime/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { invalido, naoEncontrado } from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';
import { obterAtendimento } from '../../servicos/atendimentos.ts';
import {
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
  selecionarComandas,
} from '../../servicos/caixa.ts';
import type { DadosDaComanda } from '../../servicos/caixa.ts';
import type {
  ComandaDoCaixa,
  ComandasDoCliente,
  ResumoDoCliente,
} from '../../servicos/caixa.contratos.ts';
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

type ComId = { Params: { id: string } };

export default async function (fastify: FastifyInstance) {
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
  const fidelidade = (req: FastifyRequest) => ({
    ativo: req.contexto.modulosAtivos.includes('fidelidade'),
  });
  // Usar pacote na comanda (e vender) só com o módulo ativo (planejamento 0034).
  const pacotes = (req: FastifyRequest) => ({
    ativo: req.contexto.modulosAtivos.includes('pacotes'),
  });
  const verCliente = {
    preHandler: fastify.exigirAlguma('clientes.ver', 'caixa.operar'),
  };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);
  const barbearia = (req: FastifyRequest) => req.contexto.barbeariaId;

  fastify.get('/caixa', operar, (req) =>
    na(req, async (c) => caixaComResumo(c, await caixaDoDia(c))),
  );
  fastify.post<{ Body: { valorInicial?: Valor } | null }>(
    '/caixa/abrir',
    // Abrir o caixa tem permissão própria: o Barbeiro opera, mas não abre
    // (planejamento 0039).
    {
      preHandler: fastify.exigir('caixa.abrir'),
      schema: corpo({ valorInicial: escalar() }),
    },
    (req) => na(req, (c) => abrirCaixa(c, barbearia(req), req.body ?? {})),
  );
  fastify.post<{ Body: { dinheiroContado?: Valor } | null }>(
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
  fastify.get<ComId>('/comandas/:id', operar, (req) =>
    na(req, (c) => obterComanda(c, req.params.id)),
  );
  fastify.post<{ Body: DadosDaComanda | null }>(
    '/comandas',
    comanda,
    async (req, reply) => {
      reply.code(201);
      return na(req, (c) =>
        salvarComanda(c, barbearia(req), req.body ?? {}, {
          fidelidade: fidelidade(req),
          pacotes: pacotes(req),
        }),
      );
    },
  );
  fastify.put<ComId & { Body: DadosDaComanda | null }>(
    '/comandas/:id',
    comanda,
    (req) =>
      na(req, (c) =>
        salvarComanda(
          c,
          barbearia(req),
          { ...req.body, id: Number(req.params.id) },
          { fidelidade: fidelidade(req), pacotes: pacotes(req) },
        ),
      ),
  );
  fastify.post<ComId & { Body: { forma?: string | null } | null }>(
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
  fastify.post<ComId>('/comandas/:id/cancelar', operar, (req) =>
    na(req, (c) => cancelarComanda(c, req.params.id)),
  );
  /** "Abrir comanda" no detalhe do agendamento. */
  fastify.post<ComId>('/comandas/do-atendimento/:id', operar, (req) =>
    na(req, async (c) => {
      const a = await obterAtendimento(c, req.params.id);
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
  async function comandasDoCliente(
    c: Conexao,
    id: number | string,
  ): Promise<ComandaDoCaixa[]> {
    const existe = await c.db
      .selectFrom('clientes')
      .select('id')
      .where('id', '=', Number(id))
      .executeTakeFirst();
    if (!existe) throw naoEncontrado('Cliente não encontrado.');
    const linhas = await selecionarComandas(c)
      .where('cm.clienteId', '=', Number(id))
      .orderBy('cx.data', 'desc')
      .orderBy('cm.hora', 'desc')
      .orderBy('cm.id', 'desc')
      .execute();
    return linhas.map(completarComanda);
  }

  fastify.get<ComId>('/clientes/:id/resumo', verCliente, (req) =>
    na(req, async (c): Promise<ResumoDoCliente> => {
      const comandas = await comandasDoCliente(c, req.params.id);
      const r = resumoDeComandas(comandas);
      const { faltas } = await c.db
        .selectFrom('atendimentos')
        .select((eb) => eb.fn.countAll<number>().as('faltas'))
        .where('clienteId', '=', Number(req.params.id))
        .where('estado', '=', 'no_show')
        .executeTakeFirstOrThrow();
      let barbeiroNome = '';
      if (r.ultimoServico?.barbeiroId) {
        const b = await c.db
          .selectFrom('barbeiros')
          .select('nome')
          .where('id', '=', r.ultimoServico.barbeiroId)
          .executeTakeFirst();
        barbeiroNome = b?.nome ?? '';
      }
      return {
        ...r,
        faltas,
        ultimoServico: r.ultimoServico && { ...r.ultimoServico, barbeiroNome },
      };
    }),
  );

  fastify.get<
    ComId & {
      Querystring: { limite?: string | null; deslocamento?: string | null };
    }
  >(
    '/clientes/:id/comandas',
    {
      ...verCliente,
      schema: query({ limite: escalar(), deslocamento: escalar() }),
    },
    (req) =>
      na(req, async (c): Promise<ComandasDoCliente> => {
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
