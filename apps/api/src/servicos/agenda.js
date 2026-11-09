import {
  estadoNaAgenda,
  fimDe,
  momentoNoFuso,
  paraMinutos,
  sobrepoe,
} from '@barbertime/dominio';
import { invalido, naoEncontrado, conflito } from '../infra/erros.js';

// Agenda no servidor (planejamentos 0019 e 0020). Fonte única: `atendimentos`
// (agenda e fila são visões dela) + `bloqueios`. Sempre numa transação com RLS (c).

/** Fuso das barbearias (por ora único; vira configuração quando houver outro). */
export const FUSO = 'America/Sao_Paulo';
export const agora = () => momentoNoFuso(new Date(), FUSO);

const hora = (coluna) => `to_char(${coluna} at time zone '${FUSO}', 'HH24:MI')`;

/** Status que ocupam o horário do barbeiro na agenda. */
export const OCUPAM = [
  'agendado',
  'chegou',
  'em_atendimento',
  'finalizado',
  'pago',
];

export const SELECT_ATENDIMENTO = `
  select a.id, a.data, a.inicio, a.fim, a.barbeiro_id as "barbeiroId",
         a.servico_id as "servicoId", a.cliente_id as "clienteId",
         a.estado as status, a.origem, a.canal, a.duracao,
         a.confirmado_em as "confirmadoEm",
         ${hora('a.chegou_em')} as "chegouAs",
         ${hora('a.iniciado_em')} as "iniciadoAs",
         ${hora('a.finalizado_em')} as "finalizadoAs",
         coalesce(c.nome, a.cliente_nome, 'Cliente balcão') as "clienteNome",
         c.telefone as "clienteTelefone",
         coalesce(s.nome, '') as "servicoNome",
         coalesce(b.nome, 'Primeiro livre') as "barbeiroNome",
         cm.id as "comandaId", cm.estado as "comandaEstado",
         a.criado_por as "criadoPor", b.usuario_id as "barbeiroUsuarioId"
    from atendimentos a
    left join barbeiros b on b.id = a.barbeiro_id
    left join servicos s on s.id = a.servico_id
    left join clientes c on c.id = a.cliente_id
    left join comandas cm on cm.atendimento_id = a.id`;

/** Linha do atendimento com o status do balcão e o estado da agenda atual. */
export const comEstado = (a) => ({
  ...a,
  estado: estadoNaAgenda({ estado: a.status, confirmadoEm: a.confirmadoEm }),
});

/** Bloqueio no formato da agenda; o id é negativo para não colidir. */
export const bloqueioNaAgenda = (b) => ({
  id: -b.id,
  data: b.data,
  inicio: b.inicio,
  fim: b.fim,
  barbeiroId: b.barbeiroId,
  servicoId: null,
  clienteId: null,
  estado: 'bloqueado',
  status: 'bloqueado',
  motivo: b.motivo,
  clienteNome: b.motivo,
  servicoNome: '',
  barbeiroNome: b.barbeiroNome,
  criadoPor: b.criadoPor,
  barbeiroUsuarioId: b.barbeiroUsuarioId,
});

export const SELECT_BLOQUEIO = `
  select k.id, k.data, k.inicio, k.fim, k.barbeiro_id as "barbeiroId", k.motivo,
         b.nome as "barbeiroNome", k.criado_por as "criadoPor",
         b.usuario_id as "barbeiroUsuarioId"
    from bloqueios k join barbeiros b on b.id = k.barbeiro_id`;

/** `travar`: trava a linha até o fim da transação (transições de estado). */
export async function buscarAtendimento(c, id, { travar = false } = {}) {
  const {
    rows: [a],
  } = await c.query(
    `${SELECT_ATENDIMENTO} where a.id = $1${travar ? ' for update of a' : ''}`,
    [Number(id)],
  );
  if (!a) throw naoEncontrado('Atendimento não encontrado.');
  return comEstado(a);
}

export async function buscarBarbeiro(c, id, { travar = false } = {}) {
  const {
    rows: [b],
  } = await c.query(
    `select id, nome, inicio, fim, comissao, em_pausa as "emPausa" from barbeiros
      where id = $1 and excluido_em is null ${travar ? 'for update' : ''}`,
    [Number(id)],
  );
  if (!b) throw invalido('Barbeiro não encontrado.');
  return b;
}

export async function buscarServico(c, id) {
  const {
    rows: [s],
  } = await c.query(
    'select id, nome, duracao, preco from servicos where id = $1 and excluido_em is null',
    [Number(id)],
  );
  if (!s) throw invalido('Serviço não encontrado.');
  return s;
}

/** Intervalos que ocupam a agenda do barbeiro no dia (atendimentos e bloqueios). */
export async function ocupadosDoDia(c, data, barbeiroId, ignorarId = null) {
  const { rows } = await c.query(
    `select inicio, fim from atendimentos
      where data = $1 and barbeiro_id = $2 and inicio is not null
        and estado = any($3) and ($4::bigint is null or id <> $4)
     union all
     select inicio, fim from bloqueios
      where data = $1 and barbeiro_id = $2 and not cancelado`,
    [data, Number(barbeiroId), OCUPAM, ignorarId],
  );
  return rows;
}

/** Expediente e conflito. Chame com o barbeiro travado (for update). */
export async function validarHorario(c, { data, inicio, fim, barbeiro }) {
  if (
    paraMinutos(inicio) < paraMinutos(barbeiro.inicio) ||
    paraMinutos(fim) > paraMinutos(barbeiro.fim)
  ) {
    throw invalido(
      `${barbeiro.nome} atende das ${barbeiro.inicio} às ${barbeiro.fim}. Escolha um horário dentro do expediente.`,
    );
  }
  const ocupados = await ocupadosDoDia(c, data, barbeiro.id);
  if (ocupados.some((o) => sobrepoe({ inicio, fim }, o))) {
    throw conflito('Esse horário acabou de ser ocupado. Escolha outro.');
  }
}

/** Reaproveita o cliente pelo telefone ou cadastra (página pública e balcão). */
export async function clientePorTelefone(c, barbeariaId, { nome, telefone }) {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (!/^\d{10,11}$/.test(digitos))
    throw invalido('Informe um telefone com DDD.');
  const {
    rows: [existente],
  } = await c.query('select id from clientes where telefone = $1', [digitos]);
  if (existente) return existente.id;
  if (!String(nome ?? '').trim()) throw invalido('Informe o nome.');
  const {
    rows: [novo],
  } = await c.query(
    'insert into clientes (barbearia_id, nome, telefone) values ($1, $2, $3) returning id',
    [barbeariaId, nome.trim(), digitos],
  );
  return novo.id;
}

/**
 * Cria um atendimento agendado. clienteId (balcão) ou cliente { nome, telefone }
 * (página pública). validarJanela: regra extra da página pública.
 */
export async function criarAgendamento(
  c,
  barbeariaId,
  { data, inicio, barbeiroId, servicoId, clienteId, cliente, canal = 'balcao' },
  { validarJanela, criadoPor = null } = {},
) {
  if (!data || !inicio) throw invalido('Escolha o dia e o horário.');
  if (data < agora().data)
    throw invalido('Não é possível agendar em um dia que já passou.');
  const servico = await buscarServico(c, servicoId);
  const barbeiro = await buscarBarbeiro(c, barbeiroId, { travar: true });
  const fim = fimDe(inicio, servico.duracao);
  if (validarJanela) validarJanela({ barbeiro, data, inicio, fim });
  await validarHorario(c, { data, inicio, fim, barbeiro });

  let idCliente = null;
  if (clienteId) {
    const r = await c.query(
      'select id from clientes where id = $1 and excluido_em is null',
      [Number(clienteId)],
    );
    if (!r.rowCount) throw invalido('Cliente não encontrado.');
    idCliente = r.rows[0].id;
  } else if (cliente) {
    idCliente = await clientePorTelefone(c, barbeariaId, cliente);
  }
  if (!idCliente) throw invalido('Escolha o cliente.');

  const {
    rows: [novo],
  } = await c.query(
    `insert into atendimentos
       (barbearia_id, origem, canal, data, inicio, fim, duracao, barbeiro_id, servico_id, cliente_id, estado, criado_por)
     values ($1, 'agendamento', $2, $3, $4, $5, $6, $7, $8, $9, 'agendado', $10) returning id`,
    [
      barbeariaId,
      canal,
      data,
      inicio,
      fim,
      servico.duracao,
      barbeiro.id,
      servico.id,
      idCliente,
      criadoPor,
    ],
  );
  return buscarAtendimento(c, novo.id);
}
