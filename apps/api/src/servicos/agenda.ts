import {
  estadoNaAgenda,
  fimDe,
  momentoNoFuso,
  paraMinutos,
  sobrepoe,
} from '@barbertime/dominio';
import { invalido, naoEncontrado, conflito } from '../infra/erros.ts';
import type { Conexao } from '../infra/banco.ts';

// Agenda no servidor (planejamentos 0019 e 0020). Fonte única: `atendimentos`
// (agenda e fila são visões dela) + `bloqueios`. Sempre numa transação com RLS (c).
//
// Exemplo de referência da conversão (planejamento 0040): as consultas simples
// usam o Kysely (`c.db`); SELECT_ATENDIMENTO e SELECT_BLOQUEIO seguem em SQL
// porque as rotas da etapa 6 os usam com `c.query` até serem convertidas.

/** Fuso das barbearias (por ora único; vira configuração quando houver outro). */
export const FUSO = 'America/Sao_Paulo';
export const agora = () => momentoNoFuso(new Date(), FUSO);

const hora = (coluna: string) =>
  `to_char(${coluna} at time zone '${FUSO}', 'HH24:MI')`;

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

/** Linha de SELECT_ATENDIMENTO (colunas já em camelCase pelo `as`). */
export interface LinhaDeAtendimento {
  id: number;
  status: string;
  confirmadoEm: string | Date | null;
  [coluna: string]: unknown;
}

/** Linha do atendimento com o status do balcão e o estado da agenda atual. */
export const comEstado = <A extends LinhaDeAtendimento>(a: A) => ({
  ...a,
  estado: estadoNaAgenda({
    estado: a.status,
    confirmadoEm: a.confirmadoEm,
  }),
});

/** Linha de SELECT_BLOQUEIO. */
export interface LinhaDeBloqueio {
  id: number;
  data: string;
  inicio: string;
  fim: string;
  barbeiroId: number;
  motivo: string;
  barbeiroNome: string;
  criadoPor: number | null;
  barbeiroUsuarioId: number | null;
}

/** Bloqueio no formato da agenda; o id é negativo para não colidir. */
export const bloqueioNaAgenda = (b: LinhaDeBloqueio) => ({
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
export async function buscarAtendimento(
  c: Conexao,
  id: number | string,
  { travar = false } = {},
) {
  const {
    rows: [a],
  } = await c.query<LinhaDeAtendimento>(
    `${SELECT_ATENDIMENTO} where a.id = $1${travar ? ' for update of a' : ''}`,
    [Number(id)],
  );
  if (!a) throw naoEncontrado('Atendimento não encontrado.');
  return comEstado(a);
}

export async function buscarBarbeiro(
  c: Conexao,
  id: number | string,
  { travar = false } = {},
) {
  let consulta = c.db
    .selectFrom('barbeiros')
    .select(['id', 'nome', 'inicio', 'fim', 'comissao', 'emPausa', 'usuarioId'])
    .where('id', '=', Number(id))
    .where('excluidoEm', 'is', null);
  if (travar) consulta = consulta.forUpdate();
  const b = await consulta.executeTakeFirst();
  if (!b) throw invalido('Barbeiro não encontrado.');
  return b;
}

export async function buscarServico(c: Conexao, id: number | string) {
  const s = await c.db
    .selectFrom('servicos')
    .select(['id', 'nome', 'duracao', 'preco'])
    .where('id', '=', Number(id))
    .where('excluidoEm', 'is', null)
    .executeTakeFirst();
  if (!s) throw invalido('Serviço não encontrado.');
  return s;
}

/** Intervalos que ocupam a agenda do barbeiro no dia (atendimentos e bloqueios). */
export async function ocupadosDoDia(
  c: Conexao,
  data: string,
  barbeiroId: number | string,
  ignorarId: number | null = null,
): Promise<{ inicio: string; fim: string }[]> {
  let atendimentos = c.db
    .selectFrom('atendimentos')
    .select(['inicio', 'fim'])
    .where('data', '=', data)
    .where('barbeiroId', '=', Number(barbeiroId))
    .where('inicio', 'is not', null)
    .where('estado', 'in', OCUPAM);
  if (ignorarId != null)
    atendimentos = atendimentos.where('id', '<>', ignorarId);
  const linhas = await atendimentos
    .unionAll(
      c.db
        .selectFrom('bloqueios')
        .select(['inicio', 'fim'])
        .where('data', '=', data)
        .where('barbeiroId', '=', Number(barbeiroId))
        .where('cancelado', '=', false),
    )
    .execute();
  // `inicio is not null` acima: os dois vêm preenchidos.
  return linhas as { inicio: string; fim: string }[];
}

/** Expediente e conflito. Chame com o barbeiro travado (for update). */
export async function validarHorario(
  c: Conexao,
  {
    data,
    inicio,
    fim,
    barbeiro,
  }: {
    data: string;
    inicio: string;
    fim: string;
    barbeiro: { id: number; nome: string; inicio: string; fim: string };
  },
) {
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
export async function clientePorTelefone(
  c: Conexao,
  barbeariaId: number,
  { nome, telefone }: { nome?: string | null; telefone?: string | null },
): Promise<number> {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (!/^\d{10,11}$/.test(digitos))
    throw invalido('Informe um telefone com DDD.');
  const existente = await c.db
    .selectFrom('clientes')
    .select('id')
    .where('telefone', '=', digitos)
    .executeTakeFirst();
  if (existente) return existente.id;
  if (!String(nome ?? '').trim()) throw invalido('Informe o nome.');
  const novo = await c.db
    .insertInto('clientes')
    .values({ barbeariaId, nome: String(nome).trim(), telefone: digitos })
    .returning('id')
    .executeTakeFirstOrThrow();
  return novo.id;
}

/**
 * Cria um atendimento agendado. clienteId (balcão) ou cliente { nome, telefone }
 * (página pública). validarJanela: regra extra da página pública.
 */
export async function criarAgendamento(
  c: Conexao,
  barbeariaId: number,
  {
    data,
    inicio,
    barbeiroId,
    servicoId,
    clienteId,
    cliente,
    canal = 'balcao',
  }: {
    data?: string | null;
    inicio?: string | null;
    barbeiroId: number | string;
    servicoId: number | string;
    clienteId?: number | string | null;
    cliente?: { nome?: string | null; telefone?: string | null } | null;
    canal?: string;
  },
  {
    validarJanela,
    criadoPor = null,
  }: {
    validarJanela?: (janela: {
      barbeiro: Awaited<ReturnType<typeof buscarBarbeiro>>;
      data: string;
      inicio: string;
      fim: string;
    }) => void;
    criadoPor?: number | null;
  } = {},
) {
  if (!data || !inicio) throw invalido('Escolha o dia e o horário.');
  if (data < agora().data)
    throw invalido('Não é possível agendar em um dia que já passou.');
  const servico = await buscarServico(c, servicoId);
  const barbeiro = await buscarBarbeiro(c, barbeiroId, { travar: true });
  const fim = fimDe(inicio, servico.duracao);
  if (validarJanela) validarJanela({ barbeiro, data, inicio, fim });
  await validarHorario(c, { data, inicio, fim, barbeiro });

  let idCliente: number | null = null;
  if (clienteId) {
    const existe = await c.db
      .selectFrom('clientes')
      .select('id')
      .where('id', '=', Number(clienteId))
      .where('excluidoEm', 'is', null)
      .executeTakeFirst();
    if (!existe) throw invalido('Cliente não encontrado.');
    idCliente = existe.id;
  } else if (cliente) {
    idCliente = await clientePorTelefone(c, barbeariaId, cliente);
  }
  if (!idCliente) throw invalido('Escolha o cliente.');

  const novo = await c.db
    .insertInto('atendimentos')
    .values({
      barbeariaId,
      origem: 'agendamento',
      canal,
      data,
      inicio,
      fim,
      duracao: servico.duracao,
      barbeiroId: barbeiro.id,
      servicoId: servico.id,
      clienteId: idCliente,
      estado: 'agendado',
      criadoPor,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return buscarAtendimento(c, novo.id);
}
