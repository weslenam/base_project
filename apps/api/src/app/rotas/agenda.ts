import {
  horariosLivres,
  paraMinutos,
  podeAgirNaAgenda,
} from '@barbertime/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { invalido, naoEncontrado, proibido } from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';
import {
  agora,
  bloqueioNaAgenda,
  buscarBarbeiro,
  buscarServico,
  criarAgendamento,
  ocupadosDoDia,
  validarHorario,
} from '../../servicos/agenda.ts';
import {
  atendimentosOnde,
  bloqueiosOnde,
  obterAtendimento,
} from '../../servicos/atendimentos.ts';
import { cancelarComanda } from '../../servicos/caixa.ts';
import type {
  BloqueioNaAgenda,
  DetalheDoAgendamento,
  ItemDaAgenda,
} from '../../servicos/agenda.contratos.ts';
import {
  campoData,
  campoHora,
  clienteResumido,
  corpo,
  inteiro,
  query,
  texto,
} from '../esquemas.ts';

// Agenda interna (planejamentos 0019 e 0020). Lê `atendimentos` + `bloqueios` e
// fala o vocabulário da tela atual (pendente, confirmado, atendido, faltou...).
// Quem só tem agenda.ver_propria vê apenas o barbeiro ligado à própria conta.

interface Acao {
  de: string[];
  confirmar?: boolean;
  para?: string;
}

/** Ações da agenda atual → status do atendimento. */
const ACOES: Record<string, Acao> = {
  confirmado: { de: ['agendado'], confirmar: true },
  // Sem check-in não há comanda: "atendido" só depois de chegar (ciclo do domínio).
  atendido: { de: ['chegou', 'em_atendimento'], para: 'finalizado' },
  faltou: { de: ['agendado'], para: 'no_show' },
  cancelado: { de: ['agendado', 'chegou'], para: 'cancelado' },
};

type ComId = { Params: { id: string } };

export default async function (fastify: FastifyInstance) {
  const ver = {
    preHandler: fastify.exigirAlguma('agenda.ver', 'agenda.ver_propria'),
  };
  // Quem gerencia age em tudo; quem ajuda (Barbeiro) marca e bloqueia em
  // qualquer coluna, mas só mexe no que é seu (planejamento 0035).
  const marcar = {
    preHandler: fastify.exigirAlguma('agenda.gerenciar', 'agenda.ajudar'),
  };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);
  const soOsProprios = (req: FastifyRequest) =>
    !req.contexto.permissoes.includes('agenda.ver');

  fastify.get<{ Querystring: { data?: string | null } }>(
    '/agendamentos',
    { ...ver, schema: query({ data: campoData }) },
    (req) =>
      na(req, async (c): Promise<ItemDaAgenda[]> => {
        const data = String(req.query.data ?? agora().data);
        const eu = soOsProprios(req) ? req.contexto.usuarioId : null;
        const atendimentos = await atendimentosOnde(
          c,
          sql`where a.data = ${data} and a.inicio is not null
            and a.estado not in ('cancelado', 'desistiu')
            and (${eu}::bigint is null or b.usuario_id = ${eu})`,
        );
        const bloqueios = await bloqueiosOnde(
          c,
          sql`where k.data = ${data} and not k.cancelado
            and (${eu}::bigint is null or b.usuario_id = ${eu})`,
        );
        // Na agenda só entram atendimentos com início (`a.inicio is not null`).
        return [...atendimentos, ...bloqueios.map(bloqueioNaAgenda)].sort(
          (x, y) => paraMinutos(x.inicio ?? '') - paraMinutos(y.inicio ?? ''),
        );
      }),
  );

  fastify.get<{
    Querystring: {
      data?: string | null;
      barbeiroId?: number | null;
      servicoId?: number | null;
    };
  }>(
    '/agendamentos/horarios',
    {
      ...ver,
      schema: query({
        data: campoData,
        barbeiroId: inteiro,
        servicoId: inteiro,
      }),
    },
    (req) =>
      na(req, async (c) => {
        const { data, barbeiroId, servicoId } = req.query;
        // Os buscar* fazem Number(id): o mesmo valor de antes da conversão.
        const barbeiro = await buscarBarbeiro(c, Number(barbeiroId));
        const servico = await buscarServico(c, Number(servicoId));
        const hoje = agora();
        // Sem data, a comparação dava falso em JS e a consulta seguia com a
        // data vazia (grade toda livre). Mantido na conversão: issue #39; o
        // `as` só repete o que o JS já fazia.
        const dia = data as string;
        if (dia < hoje.data) return [];
        return horariosLivres({
          expediente: barbeiro,
          duracao: servico.duracao,
          ocupados: await ocupadosDoDia(c, dia, barbeiro.id),
          aPartirDe: dia === hoje.data ? hoje.hora : undefined,
        });
      }),
  );

  async function bloqueio(
    c: Conexao,
    id: number | string,
  ): Promise<BloqueioNaAgenda> {
    const [k] = await bloqueiosOnde(
      c,
      sql`where k.id = ${-Number(id)} and not k.cancelado`,
    );
    if (!k) throw naoEncontrado('Bloqueio não encontrado.');
    return bloqueioNaAgenda(k);
  }

  /** Quem só vê a própria agenda não lê item de outro barbeiro. */
  async function exigirProprio(
    c: Conexao,
    req: FastifyRequest,
    barbeiroId: number | null,
  ): Promise<void> {
    if (!soOsProprios(req)) return;
    // Sem barbeiro no item, não há dono: o `id = null` do SQL também não achava.
    const dono =
      barbeiroId == null
        ? undefined
        : await c.db
            .selectFrom('barbeiros')
            .select('id')
            .where('id', '=', barbeiroId)
            .where('usuarioId', '=', req.contexto.usuarioId)
            .executeTakeFirst();
    if (!dono) throw proibido('Esse agendamento é de outro barbeiro.');
  }

  fastify.get<ComId>('/agendamentos/:id', ver, (req) =>
    na(req, async (c): Promise<BloqueioNaAgenda | DetalheDoAgendamento> => {
      if (Number(req.params.id) < 0) {
        const k = await bloqueio(c, req.params.id);
        await exigirProprio(c, req, k.barbeiroId);
        return k;
      }
      const a = await obterAtendimento(c, req.params.id);
      await exigirProprio(c, req, a.barbeiroId);
      // Sem cliente, o `id = null` do SQL também não achava nada.
      const cli =
        a.clienteId == null
          ? undefined
          : await c.db
              .selectFrom('clientes')
              .select('observacoes')
              .where('id', '=', a.clienteId)
              .executeTakeFirst();
      return { ...a, clienteObservacoes: cli?.observacoes ?? '' };
    }),
  );

  fastify.post<{
    Body: {
      data?: string | null;
      inicio?: string | null;
      barbeiroId?: number | null;
      servicoId?: number | null;
      clienteId?: number | null;
      cliente?: { nome?: string | null; telefone?: string | null } | null;
    } | null;
  }>(
    '/agendamentos',
    {
      ...marcar,
      schema: corpo({
        data: campoData,
        inicio: campoHora,
        barbeiroId: inteiro,
        servicoId: inteiro,
        clienteId: inteiro,
        cliente: clienteResumido,
      }),
    },
    async (req, reply) => {
      const dados = req.body ?? {};
      const r = await na(req, (c) =>
        criarAgendamento(
          c,
          req.contexto.barbeariaId,
          {
            ...dados,
            // Os buscar* fazem Number(id): o mesmo valor de antes da conversão.
            barbeiroId: Number(dados.barbeiroId),
            servicoId: Number(dados.servicoId),
          },
          { criadoPor: req.contexto.usuarioId },
        ),
      );
      reply.code(201);
      return r;
    },
  );

  fastify.post<{
    Body: {
      data?: string | null;
      inicio?: string | null;
      fim?: string | null;
      barbeiroId?: number | null;
      motivo?: string | null;
    } | null;
  }>(
    '/agendamentos/bloqueios',
    {
      ...marcar,
      schema: corpo({
        data: campoData,
        inicio: campoHora,
        fim: campoHora,
        barbeiroId: inteiro,
        motivo: texto(200),
      }),
    },
    async (req, reply) => {
      const { data, inicio, fim, barbeiroId, motivo } = req.body ?? {};
      const dia = String(data ?? '');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dia) ||
        !inicio ||
        !fim ||
        paraMinutos(inicio) >= paraMinutos(fim)
      )
        throw invalido('O fim do bloqueio precisa ser depois do início.');
      const r = await na(req, async (c) => {
        const barbeiro = await buscarBarbeiro(c, Number(barbeiroId), {
          travar: true,
        });
        await validarHorario(c, { data: dia, inicio, fim, barbeiro });
        const novo = await c.db
          .insertInto('bloqueios')
          .values({
            barbeariaId: req.contexto.barbeariaId,
            barbeiroId: barbeiro.id,
            data: dia,
            inicio,
            fim,
            motivo: String(motivo ?? '').trim() || 'Bloqueado',
            criadoPor: req.contexto.usuarioId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        return bloqueio(c, -novo.id);
      });
      reply.code(201);
      return r;
    },
  );

  /** Ações da agenda atual: confirmar, marcar atendido, falta ou cancelar. */
  fastify.put<ComId & { Body: { estado?: string | null } | null }>(
    '/agendamentos/:id/estado',
    { ...marcar, schema: corpo({ estado: texto(20) }) },
    (req) =>
      na(req, async (c) => {
        const estado = req.body?.estado;
        const negado = () =>
          invalido('Esse agendamento não pode mais mudar para esse estado.');
        const exigirPermitido = (
          item: Parameters<typeof podeAgirNaAgenda>[1],
          acao: string,
        ) => {
          if (!podeAgirNaAgenda(req.contexto, item, acao))
            throw proibido(
              item?.bloqueio
                ? 'Você só pode remover os bloqueios que você criou.'
                : 'Você só pode mexer nos agendamentos que você marcou ou nos seus atendimentos.',
            );
        };
        if (Number(req.params.id) < 0) {
          const k = await bloqueio(c, req.params.id);
          // No bloqueio, a permissão não depende do estado pedido (só de quem
          // criou); o estado é conferido logo depois, como antes.
          exigirPermitido({ ...k, bloqueio: true }, String(estado));
          if (estado !== 'cancelado') throw negado();
          await c.db
            .updateTable('bloqueios')
            .set({ cancelado: true })
            .where('id', '=', -k.id)
            .execute();
          return { ...k, estado: 'cancelado' };
        }
        if (estado == null || !Object.hasOwn(ACOES, estado)) throw negado();
        const acao = ACOES[estado] as Acao;
        const a = await obterAtendimento(c, req.params.id, { travar: true });
        exigirPermitido(a, estado);
        // Como na agenda atual: pendente só confirma ou cancela.
        const pendente = a.status === 'agendado' && !a.confirmadoEm;
        if (
          !acao.de.includes(a.status) ||
          (acao.confirmar && a.confirmadoEm) ||
          (pendente && (estado === 'atendido' || estado === 'faltou'))
        )
          throw negado();
        if (acao.confirmar) {
          await c.db
            .updateTable('atendimentos')
            .set({ confirmadoEm: sql<Date>`now()` })
            .where('id', '=', a.id)
            .execute();
        } else if (acao.para) {
          const para = acao.para;
          await c.db
            .updateTable('atendimentos')
            .set({
              estado: para,
              ...(para === 'finalizado'
                ? { finalizadoEm: sql<Date>`now()` }
                : {}),
            })
            .where('id', '=', a.id)
            .execute();
          // Como o "desistir" do balcão: a comanda aberta no check-in cai junto.
          if (para === 'cancelado' && a.comandaEstado === 'aberta')
            await cancelarComanda(c, Number(a.comandaId));
        }
        return obterAtendimento(c, a.id);
      }),
  );
}
