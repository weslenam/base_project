import { horariosLivres, paraMinutos } from '@barbertime/dominio';
import { invalido, proibido } from '../../infra/erros.js';
import {
  SELECT_AGENDAMENTO,
  agora,
  buscarAgendamento,
  buscarBarbeiro,
  buscarServico,
  criarAgendamento,
  ocupadosDoDia,
  validarHorario,
} from '../../servicos/agenda.js';

// Agenda interna (planejamento 0019). Quem só tem agenda.ver_propria vê apenas
// os agendamentos do barbeiro ligado à própria conta.

const TRANSICOES = {
  pendente: ['confirmado', 'cancelado'],
  confirmado: ['atendido', 'faltou', 'cancelado'],
  bloqueado: ['cancelado'],
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
      const proprios = soOsProprios(req);
      const { rows } = await c.query(
        `${SELECT_AGENDAMENTO}
          where a.data = $1 and a.estado <> 'cancelado'
            and ($2::bigint is null or b.usuario_id = $2)
          order by a.inicio`,
        [data, proprios ? req.contexto.usuarioId : null],
      );
      return rows;
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

  fastify.get('/agendamentos/:id', ver, (req) =>
    na(req, async (c) => {
      const a = await buscarAgendamento(c, req.params.id);
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
      } = await c.query(
        'select telefone, observacoes from clientes where id = $1',
        [a.clienteId],
      );
      return {
        ...a,
        clienteTelefone: cli?.telefone ?? null,
        clienteObservacoes: cli?.observacoes ?? '',
      };
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
        `insert into agendamentos (barbearia_id, data, inicio, fim, barbeiro_id, estado, motivo)
         values ($1, $2, $3, $4, $5, 'bloqueado', $6) returning id`,
        [
          req.contexto.barbeariaId,
          data,
          inicio,
          fim,
          barbeiro.id,
          String(motivo ?? '').trim() || 'Bloqueado',
        ],
      );
      return buscarAgendamento(c, novo.id);
    });
    reply.code(201);
    return r;
  });

  /** pendente → confirmado → atendido | faltou; qualquer um (menos atendido) → cancelado. */
  fastify.put('/agendamentos/:id/estado', gerenciar, (req) =>
    na(req, async (c) => {
      const a = await buscarAgendamento(c, req.params.id);
      const estado = req.body?.estado;
      if (!TRANSICOES[a.estado]?.includes(estado))
        throw invalido(
          'Esse agendamento não pode mais mudar para esse estado.',
        );
      await c.query('update agendamentos set estado = $2 where id = $1', [
        a.id,
        estado,
      ]);
      return buscarAgendamento(c, a.id);
    }),
  );
}
