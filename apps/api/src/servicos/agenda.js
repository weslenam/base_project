import {
  fimDe,
  momentoNoFuso,
  ocupaHorario,
  paraMinutos,
  sobrepoe,
} from '@barbertime/dominio';
import { invalido, naoEncontrado, conflito } from '../infra/erros.js';

// Regras da agenda no servidor (planejamento 0019), usadas pelas rotas internas
// e pela página pública. Sempre dentro de uma transação com RLS (c).

/** Fuso das barbearias (por ora único; vira configuração quando houver outro). */
export const FUSO = 'America/Sao_Paulo';
export const agora = () => momentoNoFuso(new Date(), FUSO);

export const SELECT_AGENDAMENTO = `
  select a.id, a.data, a.inicio, a.fim, a.barbeiro_id as "barbeiroId",
         a.servico_id as "servicoId", a.cliente_id as "clienteId", a.estado,
         a.motivo, a.origem,
         coalesce(c.nome, a.motivo, '') as "clienteNome",
         coalesce(s.nome, '') as "servicoNome",
         b.nome as "barbeiroNome"
    from agendamentos a
    join barbeiros b on b.id = a.barbeiro_id
    left join servicos s on s.id = a.servico_id
    left join clientes c on c.id = a.cliente_id`;

export async function buscarAgendamento(c, id) {
  const {
    rows: [a],
  } = await c.query(`${SELECT_AGENDAMENTO} where a.id = $1`, [Number(id)]);
  if (!a) throw naoEncontrado('Agendamento não encontrado.');
  return a;
}

export async function buscarBarbeiro(c, id, { travar = false } = {}) {
  const {
    rows: [b],
  } = await c.query(
    `select id, nome, inicio, fim, comissao from barbeiros
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

/** Intervalos que ocupam a agenda do barbeiro no dia. */
export async function ocupadosDoDia(c, data, barbeiroId, ignorarId = null) {
  const { rows } = await c.query(
    `select id, inicio, fim, estado from agendamentos
      where data = $1 and barbeiro_id = $2 and ($3::bigint is null or id <> $3)`,
    [data, Number(barbeiroId), ignorarId],
  );
  return rows.filter((a) => ocupaHorario(a.estado));
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
 * Cria um agendamento pendente. clienteId (balcão) ou cliente { nome, telefone }
 * (página pública). validarJanela: regra extra da página pública.
 */
export async function criarAgendamento(
  c,
  barbeariaId,
  {
    data,
    inicio,
    barbeiroId,
    servicoId,
    clienteId,
    cliente,
    origem = 'balcao',
  },
  { validarJanela } = {},
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
    const r = await c.query('select id from clientes where id = $1', [
      Number(clienteId),
    ]);
    if (!r.rowCount) throw invalido('Cliente não encontrado.');
    idCliente = r.rows[0].id;
  } else if (cliente) {
    idCliente = await clientePorTelefone(c, barbeariaId, cliente);
  }
  if (!idCliente) throw invalido('Escolha o cliente.');

  const {
    rows: [novo],
  } = await c.query(
    `insert into agendamentos
       (barbearia_id, data, inicio, fim, barbeiro_id, servico_id, cliente_id, estado, origem)
     values ($1, $2, $3, $4, $5, $6, $7, 'pendente', $8) returning id`,
    [
      barbeariaId,
      data,
      inicio,
      fim,
      barbeiro.id,
      servico.id,
      idCliente,
      origem,
    ],
  );
  return buscarAgendamento(c, novo.id);
}
