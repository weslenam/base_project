import { horariosLivres, paraMinutos } from '@barbertime/dominio';
import { invalido, naoEncontrado, proibido } from '../../infra/erros.js';
import {
  SELECT_ATENDIMENTO,
  SELECT_BLOQUEIO,
  agora,
  bloqueioNaAgenda,
  buscarAtendimento,
  buscarBarbeiro,
  buscarServico,
  comEstado,
  criarAgendamento,
  ocupadosDoDia,
  validarHorario,
} from '../../servicos/agenda.js';

// Agenda interna (planejamentos 0019 e 0020). Lê `atendimentos` + `bloqueios` e
// fala o vocabulário da tela atual (pendente, confirmado, atendido, faltou...).
// Quem só tem agenda.ver_propria vê apenas o barbeiro ligado à própria conta.

/** Ações da agenda atual → status do atendimento. */
const ACOES = {
  confirmado: { de: ['agendado'], confirmar: true },
  atendido: {
    de: ['agendado', 'chegou', 'em_atendimento'],
    para: 'finalizado',
  },
  faltou: { de: ['agendado'], para: 'no_show' },
  cancelado: { de: ['agendado', 'chegou'], para: 'cancelado' },
};

export default async function (fastify) {
  const ver = {
    preHandler: fastify.exigirAlguma('agenda.ver', 'agenda.ver_propria'),
  };
  const gerenciar = { preHandler: fastify.exigir('agenda.gerenciar') };
  const na = (req, fn) => fastify.naBarbearia(req, fn);
  const soOsProprios = (req) => !req.contexto.permissoes.includes('agenda.ver');

  fastify.get('/agendamentos', ver, (req) =>
    na(req, async (c) => {
      const data = String(req.query.data ?? agora().data);
      const eu = soOsProprios(req) ? req.contexto.usuarioId : null;
      const { rows: atendimentos } = await c.query(
        `${SELECT_ATENDIMENTO}
          where a.data = $1 and a.inicio is not null
            and a.estado not in ('cancelado', 'desistiu')
            and ($2::bigint is null or b.usuario_id = $2)`,
        [data, eu],
      );
      const { rows: bloqueios } = await c.query(
        `${SELECT_BLOQUEIO}
          where k.data = $1 and not k.cancelado and ($2::bigint is null or b.usuario_id = $2)`,
        [data, eu],
      );
      return [
        ...atendimentos.map(comEstado),
        ...bloqueios.map(bloqueioNaAgenda),
      ].sort((x, y) => paraMinutos(x.inicio) - paraMinutos(y.inicio));
    }),
  );

  fastify.get('/agendamentos/horarios', ver, (req) =>
    na(req, async (c) => {
      const { data, barbeiroId, servicoId } = req.query;
      const barbeiro = await buscarBarbeiro(c, barbeiroId);
      const servico = await buscarServico(c, servicoId);
      const hoje = agora();
      if (data < hoje.data) return [];
      return horariosLivres({
        expediente: barbeiro,
        duracao: servico.duracao,
        ocupados: await ocupadosDoDia(c, data, barbeiro.id),
        aPartirDe: data === hoje.data ? hoje.hora : undefined,
      });
    }),
  );

  async function bloqueio(c, id) {
    const {
      rows: [k],
    } = await c.query(
      `${SELECT_BLOQUEIO} where k.id = $1 and not k.cancelado`,
      [-Number(id)],
    );
    if (!k) throw naoEncontrado('Bloqueio não encontrado.');
    return bloqueioNaAgenda(k);
  }

  fastify.get('/agendamentos/:id', ver, (req) =>
    na(req, async (c) => {
      if (Number(req.params.id) < 0) return bloqueio(c, req.params.id);
      const a = await buscarAtendimento(c, req.params.id);
      if (soOsProprios(req)) {
        const dono = await c.query(
          'select 1 from barbeiros where id = $1 and usuario_id = $2',
          [a.barbeiroId, req.contexto.usuarioId],
        );
        if (!dono.rowCount)
          throw proibido('Esse agendamento é de outro barbeiro.');
      }
      const {
        rows: [cli],
      } = await c.query('select observacoes from clientes where id = $1', [
        a.clienteId,
      ]);
      return { ...a, clienteObservacoes: cli?.observacoes ?? '' };
    }),
  );

  fastify.post('/agendamentos', gerenciar, async (req, reply) => {
    const r = await na(req, (c) =>
      criarAgendamento(c, req.contexto.barbeariaId, req.body ?? {}),
    );
    reply.code(201);
    return r;
  });

  fastify.post('/agendamentos/bloqueios', gerenciar, async (req, reply) => {
    const { data, inicio, fim, barbeiroId, motivo } = req.body ?? {};
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? '')) ||
      !inicio ||
      !fim ||
      paraMinutos(inicio) >= paraMinutos(fim)
    )
      throw invalido('O fim do bloqueio precisa ser depois do início.');
    const r = await na(req, async (c) => {
      const barbeiro = await buscarBarbeiro(c, barbeiroId, { travar: true });
      await validarHorario(c, { data, inicio, fim, barbeiro });
      const {
        rows: [novo],
      } = await c.query(
        `insert into bloqueios (barbearia_id, barbeiro_id, data, inicio, fim, motivo)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [
          req.contexto.barbeariaId,
          barbeiro.id,
          data,
          inicio,
          fim,
          String(motivo ?? '').trim() || 'Bloqueado',
        ],
      );
      return bloqueio(c, -novo.id);
    });
    reply.code(201);
    return r;
  });

  /** Ações da agenda atual: confirmar, marcar atendido, falta ou cancelar. */
  fastify.put('/agendamentos/:id/estado', gerenciar, (req) =>
    na(req, async (c) => {
      const estado = req.body?.estado;
      const negado = () =>
        invalido('Esse agendamento não pode mais mudar para esse estado.');
      if (Number(req.params.id) < 0) {
        const k = await bloqueio(c, req.params.id);
        if (estado !== 'cancelado') throw negado();
        await c.query('update bloqueios set cancelado = true where id = $1', [
          -k.id,
        ]);
        return { ...k, estado: 'cancelado' };
      }
      const a = await buscarAtendimento(c, req.params.id);
      const acao = ACOES[estado];
      // Como na agenda atual: pendente só confirma ou cancela.
      const pendente = a.status === 'agendado' && !a.confirmadoEm;
      if (
        !acao?.de.includes(a.status) ||
        (acao.confirmar && a.confirmadoEm) ||
        (pendente && (estado === 'atendido' || estado === 'faltou'))
      )
        throw negado();
      if (acao.confirmar) {
        await c.query(
          'update atendimentos set confirmado_em = now() where id = $1',
          [a.id],
        );
      } else {
        await c.query(
          `update atendimentos set estado = $2,
             finalizado_em = case when $2 = 'finalizado' then now() else finalizado_em end
           where id = $1`,
          [a.id, acao.para],
        );
      }
      return buscarAtendimento(c, a.id);
    }),
  );
}
