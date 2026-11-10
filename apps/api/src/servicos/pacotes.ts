import {
  cicloDaRenovacao,
  podeUsarPacote,
  saldoDoPacote,
  validarPacote,
  vigenciaDoPacote,
} from '@barbertime/dominio';
import type { ItemComanda, UsoDePacote, Valor } from '@barbertime/dominio';
import { sql } from 'kysely';
import { conflito, invalido, naoEncontrado } from '../infra/erros.ts';
import type { Conexao } from '../infra/banco.ts';
import type {
  AssinaturaDoCliente,
  PacoteDoCatalogo,
  PodeUsarPacote,
} from '@barbertime/contratos';

// Pacotes e assinaturas no banco (planejamento 0034, etapa B; regras do 0015).
// Tudo roda no contexto da barbearia (RLS). A venda e a renovação abrem uma
// comanda no caixa; a assinatura vale quando ela é paga. O uso é o serviço a
// R$ 0 na comanda, conferido ao salvar e de novo ao receber, com a assinatura
// travada.

const selecionarPacotes = (c: Conexao) =>
  c.db
    .selectFrom('pacotes')
    .select([
      'id',
      'nome',
      'preco',
      'tipo',
      'validadeDias',
      'intervaloMinimoDias',
      'maximoPorSemana',
      'excluidoEm',
    ]);

type LinhaDePacote = Awaited<
  ReturnType<ReturnType<typeof selecionarPacotes>['execute']>
>[number];

/** Pacotes com itens e limites no formato do domínio. */
async function completarPacotes(
  c: Conexao,
  linhas: LinhaDePacote[],
): Promise<PacoteDoCatalogo[]> {
  if (!linhas.length) return [];
  const itens = await c.db
    .selectFrom('pacoteItens as pi')
    .innerJoin('servicos as s', 's.id', 'pi.servicoId')
    .select([
      'pi.pacoteId',
      'pi.servicoId',
      's.nome as servicoNome',
      'pi.quantidade',
    ])
    .where(
      'pi.pacoteId',
      'in',
      linhas.map((p) => p.id),
    )
    .orderBy('s.nome')
    .execute();
  return linhas.map(
    ({ intervaloMinimoDias, maximoPorSemana, excluidoEm, ...p }) => ({
      ...p,
      itens: itens
        .filter((i) => i.pacoteId === p.id)
        .map(({ servicoId, servicoNome, quantidade }) => ({
          servicoId,
          servicoNome,
          quantidade,
        })),
      limites: { intervaloMinimoDias, maximoPorSemana },
      ...(excluidoEm ? { excluido: true as const } : {}),
    }),
  );
}

export async function listarPacotes(c: Conexao): Promise<PacoteDoCatalogo[]> {
  const linhas = await selecionarPacotes(c)
    .where('excluidoEm', 'is', null)
    .orderBy('nome')
    .execute();
  return completarPacotes(c, linhas);
}

/** Pacote pelo id; o excluído só volta com `excluidos` (assinaturas antigas). */
export async function buscarPacote(
  c: Conexao,
  id: number | string | null | undefined,
  { excluidos = false } = {},
): Promise<PacoteDoCatalogo> {
  let consulta = selecionarPacotes(c).where('id', '=', Number(id));
  if (!excluidos) consulta = consulta.where('excluidoEm', 'is', null);
  const [p] = await completarPacotes(c, await consulta.execute());
  if (!p) throw naoEncontrado('Pacote não encontrado.');
  return p;
}

const inteiroOuNulo = (v: Valor): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

/** Código do erro do Postgres (ex.: 23505, violação de índice único). */
const codigoDoErro = (erro: unknown): unknown =>
  typeof erro === 'object' && erro !== null && 'code' in erro
    ? erro.code
    : undefined;

/** Corpo de POST/PUT /pacotes (o schema da rota confere tipo e tamanho). */
export interface DadosDoPacote {
  id?: number | null;
  nome?: string | null;
  preco?: Valor;
  tipo?: string | null;
  validadeDias?: Valor;
  itens?: { servicoId?: Valor; quantidade?: Valor }[] | null;
  limites?: {
    intervaloMinimoDias?: Valor;
    maximoPorSemana?: Valor;
  } | null;
}

export async function salvarPacote(
  c: Conexao,
  barbeariaId: number,
  dados: DadosDoPacote = {},
): Promise<PacoteDoCatalogo> {
  const pacote = {
    nome: String(dados.nome ?? '').trim(),
    preco: Number(dados.preco),
    // Sem tipo, o validarPacote recusa ("Escolha o tipo do pacote").
    tipo: String(dados.tipo ?? ''),
    validadeDias:
      dados.tipo === 'unico' ? inteiroOuNulo(dados.validadeDias) : null,
    itens: (Array.isArray(dados.itens) ? dados.itens : []).map((i) => ({
      servicoId: inteiroOuNulo(i?.servicoId),
      quantidade: inteiroOuNulo(i?.quantidade),
    })),
    limites: {
      intervaloMinimoDias:
        inteiroOuNulo(dados.limites?.intervaloMinimoDias) || null,
      maximoPorSemana: inteiroOuNulo(dados.limites?.maximoPorSemana) || null,
    },
  };
  const motivo = validarPacote(pacote);
  if (motivo) throw invalido(motivo);
  if (pacote.nome.length > 120) throw invalido('O nome está muito longo.');

  // validarPacote garante um serviço em cada item (e pelo menos um item).
  const itens = pacote.itens.flatMap((i) =>
    i.servicoId == null
      ? []
      : [{ servicoId: i.servicoId, quantidade: i.quantidade }],
  );
  const servicos = await c.db
    .selectFrom('servicos')
    .select('id')
    .where(
      'id',
      'in',
      itens.map((i) => i.servicoId),
    )
    .where('excluidoEm', 'is', null)
    .execute();
  if (servicos.length !== pacote.itens.length)
    throw invalido('Serviço do pacote não encontrado.');

  const id = dados.id ? Number(dados.id) : null;
  let mesmoNome = c.db
    .selectFrom('pacotes')
    .select('nome')
    .where((eb) =>
      eb(eb.fn('lower', ['nome']), '=', eb.fn('lower', [eb.val(pacote.nome)])),
    )
    .where('excluidoEm', 'is', null);
  if (id != null) mesmoNome = mesmoNome.where('id', '<>', id);
  const repetido = await mesmoNome.executeTakeFirst();
  if (repetido)
    throw conflito(`Já existe um pacote chamado "${repetido.nome}".`);

  const valores = {
    nome: pacote.nome,
    preco: pacote.preco,
    tipo: pacote.tipo,
    validadeDias: pacote.validadeDias,
    intervaloMinimoDias: pacote.limites.intervaloMinimoDias,
    maximoPorSemana: pacote.limites.maximoPorSemana,
  };
  let pacoteId: number;
  try {
    if (id) {
      const r = await c.db
        .updateTable('pacotes')
        .set(valores)
        .where('id', '=', id)
        .where('excluidoEm', 'is', null)
        .executeTakeFirst();
      if (!Number(r.numUpdatedRows))
        throw naoEncontrado('Pacote não encontrado.');
      await c.db.deleteFrom('pacoteItens').where('pacoteId', '=', id).execute();
      pacoteId = id;
    } else {
      const novo = await c.db
        .insertInto('pacotes')
        .values({ barbeariaId, ...valores })
        .returning('id')
        .executeTakeFirstOrThrow();
      pacoteId = novo.id;
    }
  } catch (erro) {
    // Dois cadastros com o mesmo nome ao mesmo tempo: o índice único decide.
    if (codigoDoErro(erro) === '23505')
      throw conflito(`Já existe um pacote chamado "${pacote.nome}".`);
    throw erro;
  }
  for (const i of itens)
    await c.db
      .insertInto('pacoteItens')
      .values({
        pacoteId,
        barbeariaId,
        servicoId: i.servicoId,
        quantidade: i.quantidade,
      })
      .execute();
  return buscarPacote(c, pacoteId);
}

/** Exclusão lógica; recusada com cliente com o pacote em vigor ou a pagar. */
export async function excluirPacote(
  c: Conexao,
  id: number | string,
  hoje: string,
): Promise<void> {
  const pacote = await buscarPacote(c, id);
  const { vendidos } = await c.db
    .selectFrom('assinaturas')
    .select((eb) => eb.fn.count<number>('clienteId').distinct().as('vendidos'))
    .where('pacoteId', '=', pacote.id)
    .where('estado', '<>', 'cancelada')
    .where((eb) => eb.or([eb('fim', 'is', null), eb('fim', '>=', hoje)]))
    .executeTakeFirstOrThrow();
  if (vendidos)
    throw conflito(
      `Não é possível excluir "${pacote.nome}": ${vendidos} cliente(s) com o pacote em vigor.`,
    );
  await c.db
    .updateTable('pacotes')
    .set({ excluidoEm: sql`now()` })
    .where('id', '=', pacote.id)
    .execute();
}

// ---- assinaturas ----

const selecionarAssinaturas = (c: Conexao) =>
  c.db
    .selectFrom('assinaturas')
    .select([
      'id',
      'clienteId',
      'pacoteId',
      'estado',
      'inicio',
      'fim',
      'comandaVendaId',
      'renovacaoDe',
    ]);

type LinhaDeAssinatura = Awaited<
  ReturnType<ReturnType<typeof selecionarAssinaturas>['execute']>
>[number];

async function usosDe(c: Conexao, ids: number[]) {
  if (!ids.length) return [];
  return c.db
    .selectFrom('usosAssinatura')
    .select(['assinaturaId', 'servicoId', 'data', 'comandaId'])
    .where('assinaturaId', 'in', ids)
    .orderBy('data')
    .orderBy('id')
    .execute();
}

/**
 * Vigência da assinatura ativa. O banco garante que a ativa tem início e fim
 * (check da tabela); sem eles, é dado corrompido e a operação para.
 */
function vigenciaDaAtiva(a: LinhaDeAssinatura): {
  inicio: string;
  fim: string;
} {
  if (a.inicio == null || a.fim == null)
    throw new Error(`Assinatura ${a.id} ativa sem início ou fim.`);
  return { inicio: a.inicio, fim: a.fim };
}

/** Assinatura com pacote, usos, saldo do ciclo e se está em vigor hoje. */
async function completarAssinaturas(
  c: Conexao,
  linhas: LinhaDeAssinatura[],
  hoje: string,
): Promise<AssinaturaDoCliente[]> {
  const usos = await usosDe(
    c,
    linhas.map((a) => a.id),
  );
  const pacotes = new Map<number, PacoteDoCatalogo>();
  for (const id of new Set(linhas.map((a) => a.pacoteId)))
    pacotes.set(id, await buscarPacote(c, id, { excluidos: true }));
  // Ciclo com renovação em andamento ou paga: a tela não oferece renovar de novo.
  const renovadas = linhas.length
    ? await c.db
        .selectFrom('assinaturas')
        .select(['renovacaoDe as id', 'estado'])
        .where(
          'renovacaoDe',
          'in',
          linhas.map((a) => a.id),
        )
        .where('estado', '<>', 'cancelada')
        .execute()
    : [];
  return linhas.map(({ renovacaoDe, ...a }) => {
    // Todo pacote das linhas foi buscado logo acima.
    const pacote = pacotes.get(a.pacoteId) as PacoteDoCatalogo;
    const comUsos = {
      ...a,
      usos: usos
        .filter((u) => u.assinaturaId === a.id)
        .map(({ servicoId, data, comandaId }) => ({
          servicoId,
          data,
          comandaId,
        })),
    };
    const renovacao = renovadas.find((r) => r.id === a.id);
    // Comparações de data com início ou fim vazios davam falso em JS: o
    // mesmo resultado, agora explícito.
    const { inicio, fim } = a;
    return {
      ...comUsos,
      renovacaoDe: renovacaoDe ?? null,
      renovacao: renovacao ? renovacao.estado : null,
      pacote,
      saldo:
        inicio && fim ? saldoDoPacote(pacote, { ...comUsos, inicio, fim }) : [],
      vigente:
        a.estado === 'ativa' &&
        inicio != null &&
        fim != null &&
        inicio <= hoje &&
        hoje <= fim,
      // Ciclo renovado que ainda não começou (data da barbearia, não do aparelho).
      aComecar: a.estado === 'ativa' && inicio != null && inicio > hoje,
      // Início do ciclo se renovar agora; null = no dia do pagamento (vencido).
      renovaEm:
        a.estado === 'ativa' &&
        pacote.tipo === 'recorrente' &&
        fim != null &&
        fim >= hoje
          ? (cicloDaRenovacao(pacote, a, hoje)?.inicio ?? null)
          : null,
    };
  });
}

export async function assinaturasDoCliente(
  c: Conexao,
  clienteId: number | string,
  hoje: string,
): Promise<AssinaturaDoCliente[]> {
  const existe = await c.db
    .selectFrom('clientes')
    .select('id')
    .where('id', '=', Number(clienteId))
    .executeTakeFirst();
  if (!existe) throw naoEncontrado('Cliente não encontrado.');
  const linhas = await selecionarAssinaturas(c)
    .where('clienteId', '=', Number(clienteId))
    .where('estado', '<>', 'cancelada')
    .orderBy(
      (eb) => eb.fn.coalesce('inicio', sql<string>`current_date`),
      'desc',
    )
    .orderBy('id', 'desc')
    .execute();
  return completarAssinaturas(c, linhas, hoje);
}

async function buscarAssinatura(
  c: Conexao,
  id: number | string,
  { travar = false } = {},
): Promise<LinhaDeAssinatura> {
  let consulta = selecionarAssinaturas(c).where('id', '=', Number(id));
  if (travar) consulta = consulta.forUpdate();
  const a = await consulta.executeTakeFirst();
  if (!a) throw naoEncontrado('Pacote do cliente não encontrado.');
  return a;
}

export async function obterAssinatura(
  c: Conexao,
  id: number | string,
  hoje: string,
): Promise<AssinaturaDoCliente> {
  const [a] = await completarAssinaturas(
    c,
    [await buscarAssinatura(c, id)],
    hoje,
  );
  // Uma linha entra, uma linha sai.
  return a as AssinaturaDoCliente;
}

/** Cliente ativo desta barbearia (a RLS limita a busca). */
async function exigirCliente(c: Conexao, id: number | string): Promise<void> {
  const r = await c.db
    .selectFrom('clientes')
    .select('id')
    .where('id', '=', Number(id))
    .where('excluidoEm', 'is', null)
    .executeTakeFirst();
  if (!r) throw invalido('Cliente não encontrado.');
}

/** Abre a comanda da venda no caixa (o caixa monta o item com o preço do catálogo). */
export type AbrirComandaDoPacote = (dados: {
  clienteId: number;
  barbeiroId?: number | null;
  itens: { tipo: 'pacote'; refId: number }[];
}) => Promise<{ id: number }>;

/**
 * Venda: a assinatura nasce aguardando o pagamento da comanda aberta por
 * `abrirComanda` (o caixa monta o item "Pacote: <nome>" com o preço do catálogo).
 */
export async function venderPacote(
  c: Conexao,
  barbeariaId: number,
  {
    clienteId,
    pacoteId,
    barbeiroId,
  }: {
    clienteId?: number | null;
    pacoteId?: number | null;
    barbeiroId?: number | null;
  },
  abrirComanda: AbrirComandaDoPacote,
): Promise<{ id: number; comandaId: number }> {
  if (!clienteId) throw invalido('Escolha o cliente.');
  await exigirCliente(c, clienteId);
  if (!pacoteId) throw invalido('Escolha o pacote.');
  const pacote = await buscarPacote(c, pacoteId);
  const comanda = await abrirComanda({
    clienteId: Number(clienteId),
    barbeiroId,
    itens: [{ tipo: 'pacote', refId: pacote.id }],
  });
  const { id } = await c.db
    .insertInto('assinaturas')
    .values({
      barbeariaId,
      clienteId: Number(clienteId),
      pacoteId: pacote.id,
      comandaVendaId: comanda.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id, comandaId: comanda.id };
}

/**
 * Renovação do pacote mensal (decisões 1 a 3 do detalhe da etapa B): uma linha
 * nova ligada à anterior, aguardando o pagamento; o ciclo é contado ao pagar.
 */
export async function renovarPacote(
  c: Conexao,
  barbeariaId: number,
  id: number | string,
  { barbeiroId }: { barbeiroId?: number | null },
  abrirComanda: AbrirComandaDoPacote,
): Promise<{ id: number; comandaId: number }> {
  const anterior = await buscarAssinatura(c, id, { travar: true });
  if (anterior.estado !== 'ativa')
    throw conflito('Só dá para renovar um pacote já pago.');
  const pacote = await buscarPacote(c, anterior.pacoteId, { excluidos: true });
  if (pacote.excluido)
    throw conflito(`O pacote ${pacote.nome} não é mais vendido.`);
  if (pacote.tipo !== 'recorrente')
    throw conflito(
      'Só o pacote mensal é renovado. Venda o pacote de novo ao cliente.',
    );
  const pendente = await c.db
    .selectFrom('assinaturas')
    .select('estado')
    .where('renovacaoDe', '=', anterior.id)
    .where('estado', '<>', 'cancelada')
    .executeTakeFirst();
  if (pendente)
    throw conflito(
      pendente.estado === 'ativa'
        ? 'Este ciclo já foi renovado.'
        : 'Já existe uma renovação aguardando pagamento no caixa.',
    );
  await exigirCliente(c, anterior.clienteId);
  const comanda = await abrirComanda({
    clienteId: anterior.clienteId,
    barbeiroId,
    itens: [{ tipo: 'pacote', refId: pacote.id }],
  });
  const { id: nova } = await c.db
    .insertInto('assinaturas')
    .values({
      barbeariaId,
      clienteId: anterior.clienteId,
      pacoteId: pacote.id,
      comandaVendaId: comanda.id,
      renovacaoDe: anterior.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id: nova, comandaId: comanda.id };
}

/**
 * Confere os usos de pacote dos itens (os da própria comanda contam juntos).
 * Com `travar`, trava as assinaturas antes de ler os usos (receber).
 */
export async function conferirUsos(
  c: Conexao,
  itens: ItemComanda[],
  clienteId: number | null,
  hoje: string,
  { travar = false } = {},
): Promise<void> {
  const doPacote = itens.filter((i) => i.assinaturaId);
  if (!doPacote.length) return;
  const ids = [...new Set(doPacote.map((i) => Number(i.assinaturaId)))].sort(
    (a, b) => a - b,
  );
  const assinaturas = new Map<number, LinhaDeAssinatura>();
  for (const id of ids)
    assinaturas.set(id, await buscarAssinatura(c, id, { travar }));
  const usos = await usosDe(c, ids);
  const pacotes = new Map<number, PacoteDoCatalogo>();
  const pendentes = new Map<number, UsoDePacote[]>();
  for (const item of doPacote) {
    // Todas as assinaturas dos itens foram buscadas (ou deram 404) acima.
    const a = assinaturas.get(Number(item.assinaturaId)) as LinhaDeAssinatura;
    if (a.clienteId !== clienteId)
      throw invalido('Esse pacote é de outro cliente.');
    if (a.estado !== 'ativa')
      throw invalido('Esse pacote ainda não foi pago ou foi cancelado.');
    let pacote = pacotes.get(a.pacoteId);
    if (!pacote) {
      pacote = await buscarPacote(c, a.pacoteId, { excluidos: true });
      pacotes.set(a.pacoteId, pacote);
    }
    const ja = pendentes.get(a.id) ?? [];
    const r = podeUsarPacote({
      pacote,
      assinatura: {
        ...a,
        ...vigenciaDaAtiva(a),
        usos: [...usos.filter((u) => u.assinaturaId === a.id), ...ja],
      },
      servicoId: Number(item.refId),
      data: hoje,
    });
    if (!r.ok)
      throw invalido(r.motivo ?? 'Esse pacote não pode ser usado agora.');
    pendentes.set(a.id, [...ja, { servicoId: Number(item.refId), data: hoje }]);
  }
}

/**
 * Comanda que vende ou renova um pacote: o item e o cliente não mudam; para
 * desistir, cancela-se a comanda (issue #22).
 */
export async function conferirVendaPendente(
  c: Conexao,
  comandaId: number | string,
  itens: ItemComanda[],
  clienteId: number | null,
): Promise<void> {
  const vendas = await c.db
    .selectFrom('assinaturas')
    .select(['pacoteId', 'clienteId'])
    .where('comandaVendaId', '=', Number(comandaId))
    .where('estado', '=', 'aguardando_pagamento')
    .execute();
  for (const v of vendas)
    if (
      clienteId !== v.clienteId ||
      !itens.some((i) => i.tipo === 'pacote' && i.refId === v.pacoteId)
    )
      throw invalido(
        'Esta comanda vende um pacote: o item e o cliente não mudam. Para desistir, cancele a comanda.',
      );
}

/** Pré-checagem da comanda: pode usar o pacote neste serviço hoje? */
export async function podeUsar(
  c: Conexao,
  {
    assinaturaId,
    servicoId,
    jaNaComanda = [],
  }: {
    assinaturaId: number | string;
    servicoId?: number | null;
    jaNaComanda?: (number | null)[];
  },
  hoje: string,
): Promise<PodeUsarPacote> {
  const a = await buscarAssinatura(c, assinaturaId);
  if (a.estado !== 'ativa')
    return {
      ok: false,
      motivo: 'Esse pacote ainda não foi pago ou foi cancelado.',
    };
  const pacote = await buscarPacote(c, a.pacoteId, { excluidos: true });
  const usos = await usosDe(c, [a.id]);
  return podeUsarPacote({
    pacote,
    assinatura: {
      ...a,
      ...vigenciaDaAtiva(a),
      usos: [
        ...usos,
        ...jaNaComanda.map((sid) => ({ servicoId: Number(sid), data: hoje })),
      ],
    },
    servicoId: Number(servicoId),
    data: hoje,
  });
}

/** O que os pacotes leem da comanda ao receber. */
export interface ComandaParaPacotes {
  id: number;
  clienteId: number | null;
  itens: ItemComanda[];
}

/**
 * Ao receber a comanda (na mesma transação): grava os usos, conferidos de novo
 * com as assinaturas travadas, e ativa a venda ou a renovação paga nela.
 */
export async function pacotesAoReceber(
  c: Conexao,
  barbeariaId: number,
  cm: ComandaParaPacotes,
  hoje: string,
): Promise<void> {
  await conferirUsos(c, cm.itens, cm.clienteId, hoje, { travar: true });
  for (const item of cm.itens.filter((i) => i.assinaturaId))
    await c.db
      .insertInto('usosAssinatura')
      .values({
        barbeariaId,
        assinaturaId: Number(item.assinaturaId),
        servicoId: Number(item.refId),
        data: hoje,
        comandaId: cm.id,
      })
      .execute();

  const vendas = await selecionarAssinaturas(c)
    .where('comandaVendaId', '=', cm.id)
    .where('estado', '=', 'aguardando_pagamento')
    .orderBy('id')
    .forUpdate()
    .execute();
  for (const a of vendas) {
    // O pacote só vale se a comanda ainda cobra por ele, para o mesmo cliente.
    const cobrado = cm.itens.some(
      (i) => i.tipo === 'pacote' && Number(i.refId) === a.pacoteId,
    );
    if (!cobrado || cm.clienteId !== a.clienteId)
      throw invalido(
        'O item do pacote ou o cliente mudou nesta comanda. Cancele a venda e venda de novo.',
      );
    const pacote = await buscarPacote(c, a.pacoteId, { excluidos: true });
    const anterior = a.renovacaoDe
      ? await buscarAssinatura(c, a.renovacaoDe)
      : null;
    const ciclo = anterior
      ? cicloDaRenovacao(pacote, anterior, hoje)
      : vigenciaDoPacote(pacote, hoje);
    // Renovação de pacote que deixou de ser mensal: não há ciclo. Antes da
    // conversão isso também parava a operação (erro 500).
    if (!ciclo)
      throw new Error(`Renovação ${a.id} de pacote que não é mais mensal.`);
    await c.db
      .updateTable('assinaturas')
      .set({ estado: 'ativa', inicio: ciclo.inicio, fim: ciclo.fim })
      .where('id', '=', a.id)
      .execute();
  }
}

/** Comanda cancelada: a venda ou renovação que esperava por ela é cancelada. */
export async function pacotesAoCancelar(
  c: Conexao,
  comandaId: number,
): Promise<void> {
  await c.db
    .updateTable('assinaturas')
    .set({ estado: 'cancelada' })
    .where('comandaVendaId', '=', comandaId)
    .where('estado', '=', 'aguardando_pagamento')
    .execute();
}
