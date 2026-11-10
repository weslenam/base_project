import {
  cicloDaRenovacao,
  podeUsarPacote,
  saldoDoPacote,
  validarPacote,
  vigenciaDoPacote,
} from '@barbertime/dominio';
import { conflito, invalido, naoEncontrado } from '../infra/erros.ts';

// Pacotes e assinaturas no banco (planejamento 0034, etapa B; regras do 0015).
// Tudo roda no contexto da barbearia (RLS). A venda e a renovação abrem uma
// comanda no caixa; a assinatura vale quando ela é paga. O uso é o serviço a
// R$ 0 na comanda, conferido ao salvar e de novo ao receber, com a assinatura
// travada.

const SELECT_PACOTE = `
  select id, nome, preco, tipo, validade_dias as "validadeDias",
         intervalo_minimo_dias as "intervaloMinimoDias",
         maximo_por_semana as "maximoPorSemana", excluido_em as "excluidoEm"
    from pacotes`;

/** Pacotes com itens e limites no formato do domínio. */
async function completarPacotes(c, linhas) {
  if (!linhas.length) return [];
  const { rows: itens } = await c.query(
    `select pi.pacote_id as "pacoteId", pi.servico_id as "servicoId",
            s.nome as "servicoNome", pi.quantidade
       from pacote_itens pi join servicos s on s.id = pi.servico_id
      where pi.pacote_id = any($1) order by s.nome`,
    [linhas.map((p) => p.id)],
  );
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
      ...(excluidoEm ? { excluido: true } : {}),
    }),
  );
}

export async function listarPacotes(c) {
  const { rows } = await c.query(
    `${SELECT_PACOTE} where excluido_em is null order by nome`,
  );
  return completarPacotes(c, rows);
}

/** Pacote pelo id; o excluído só volta com `excluidos` (assinaturas antigas). */
export async function buscarPacote(c, id, { excluidos = false } = {}) {
  const { rows } = await c.query(
    `${SELECT_PACOTE} where id = $1${excluidos ? '' : ' and excluido_em is null'}`,
    [Number(id)],
  );
  const [p] = await completarPacotes(c, rows);
  if (!p) throw naoEncontrado('Pacote não encontrado.');
  return p;
}

const inteiroOuNulo = (v) =>
  v === null || v === undefined || v === '' ? null : Number(v);

export async function salvarPacote(c, barbeariaId, dados = {}) {
  const pacote = {
    nome: String(dados.nome ?? '').trim(),
    preco: Number(dados.preco),
    tipo: dados.tipo,
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

  const { rows: servicos } = await c.query(
    'select id from servicos where id = any($1) and excluido_em is null',
    [pacote.itens.map((i) => i.servicoId)],
  );
  if (servicos.length !== pacote.itens.length)
    throw invalido('Serviço do pacote não encontrado.');

  const id = dados.id ? Number(dados.id) : null;
  const {
    rows: [repetido],
  } = await c.query(
    `select nome from pacotes where lower(nome) = lower($1) and excluido_em is null
        and ($2::bigint is null or id <> $2)`,
    [pacote.nome, id],
  );
  if (repetido)
    throw conflito(`Já existe um pacote chamado "${repetido.nome}".`);

  const valores = [
    pacote.nome,
    pacote.preco,
    pacote.tipo,
    pacote.validadeDias,
    pacote.limites.intervaloMinimoDias,
    pacote.limites.maximoPorSemana,
  ];
  let pacoteId = id;
  try {
    if (id) {
      const r = await c.query(
        `update pacotes set nome = $2, preco = $3, tipo = $4, validade_dias = $5,
         intervalo_minimo_dias = $6, maximo_por_semana = $7
       where id = $1 and excluido_em is null`,
        [id, ...valores],
      );
      if (!r.rowCount) throw naoEncontrado('Pacote não encontrado.');
      await c.query('delete from pacote_itens where pacote_id = $1', [id]);
    } else {
      const {
        rows: [novo],
      } = await c.query(
        `insert into pacotes (barbearia_id, nome, preco, tipo, validade_dias,
         intervalo_minimo_dias, maximo_por_semana)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [barbeariaId, ...valores],
      );
      pacoteId = novo.id;
    }
  } catch (erro) {
    // Dois cadastros com o mesmo nome ao mesmo tempo: o índice único decide.
    if (erro.code === '23505')
      throw conflito(`Já existe um pacote chamado "${pacote.nome}".`);
    throw erro;
  }
  for (const i of pacote.itens)
    await c.query(
      `insert into pacote_itens (pacote_id, barbearia_id, servico_id, quantidade)
       values ($1, $2, $3, $4)`,
      [pacoteId, barbeariaId, i.servicoId, i.quantidade],
    );
  return buscarPacote(c, pacoteId);
}

/** Exclusão lógica; recusada com cliente com o pacote em vigor ou a pagar. */
export async function excluirPacote(c, id, hoje) {
  const pacote = await buscarPacote(c, id);
  const {
    rows: [{ vendidos }],
  } = await c.query(
    `select count(distinct cliente_id)::int as vendidos from assinaturas
      where pacote_id = $1 and estado <> 'cancelada' and (fim is null or fim >= $2)`,
    [pacote.id, hoje],
  );
  if (vendidos)
    throw conflito(
      `Não é possível excluir "${pacote.nome}": ${vendidos} cliente(s) com o pacote em vigor.`,
    );
  await c.query('update pacotes set excluido_em = now() where id = $1', [
    pacote.id,
  ]);
}

// ---- assinaturas ----

const SELECT_ASSINATURA = `
  select id, cliente_id as "clienteId", pacote_id as "pacoteId", estado, inicio, fim,
         comanda_venda_id as "comandaVendaId", renovacao_de as "renovacaoDe"
    from assinaturas`;

async function usosDe(c, ids) {
  if (!ids.length) return [];
  const { rows } = await c.query(
    `select assinatura_id as "assinaturaId", servico_id as "servicoId", data,
            comanda_id as "comandaId"
       from usos_assinatura where assinatura_id = any($1) order by data, id`,
    [ids],
  );
  return rows;
}

/** Assinatura com pacote, usos, saldo do ciclo e se está em vigor hoje. */
async function completarAssinaturas(c, linhas, hoje) {
  const usos = await usosDe(
    c,
    linhas.map((a) => a.id),
  );
  const pacotes = new Map();
  for (const id of new Set(linhas.map((a) => a.pacoteId)))
    pacotes.set(id, await buscarPacote(c, id, { excluidos: true }));
  // Ciclo com renovação em andamento ou paga: a tela não oferece renovar de novo.
  const { rows: renovadas } = linhas.length
    ? await c.query(
        `select renovacao_de as id, estado from assinaturas
          where renovacao_de = any($1) and estado <> 'cancelada'`,
        [linhas.map((a) => a.id)],
      )
    : { rows: [] };
  return linhas.map(({ renovacaoDe, ...a }) => {
    const pacote = pacotes.get(a.pacoteId);
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
    return {
      ...comUsos,
      renovacaoDe: renovacaoDe ?? null,
      renovacao: renovacao ? renovacao.estado : null,
      pacote,
      saldo: a.inicio ? saldoDoPacote(pacote, comUsos) : [],
      vigente: a.estado === 'ativa' && a.inicio <= hoje && hoje <= a.fim,
      // Ciclo renovado que ainda não começou (data da barbearia, não do aparelho).
      aComecar: a.estado === 'ativa' && a.inicio > hoje,
      // Início do ciclo se renovar agora; null = no dia do pagamento (vencido).
      renovaEm:
        a.estado === 'ativa' && pacote.tipo === 'recorrente' && a.fim >= hoje
          ? cicloDaRenovacao(pacote, a, hoje).inicio
          : null,
    };
  });
}

export async function assinaturasDoCliente(c, clienteId, hoje) {
  const existe = await c.query('select 1 from clientes where id = $1', [
    Number(clienteId),
  ]);
  if (!existe.rowCount) throw naoEncontrado('Cliente não encontrado.');
  const { rows } = await c.query(
    `${SELECT_ASSINATURA} where cliente_id = $1 and estado <> 'cancelada'
      order by coalesce(inicio, current_date) desc, id desc`,
    [Number(clienteId)],
  );
  return completarAssinaturas(c, rows, hoje);
}

async function buscarAssinatura(c, id, { travar = false } = {}) {
  const {
    rows: [a],
  } = await c.query(
    `${SELECT_ASSINATURA} where id = $1${travar ? ' for update' : ''}`,
    [Number(id)],
  );
  if (!a) throw naoEncontrado('Pacote do cliente não encontrado.');
  return a;
}

export async function obterAssinatura(c, id, hoje) {
  const [a] = await completarAssinaturas(
    c,
    [await buscarAssinatura(c, id)],
    hoje,
  );
  return a;
}

/** Cliente ativo desta barbearia (a RLS limita a busca). */
async function exigirCliente(c, id) {
  const r = await c.query(
    'select 1 from clientes where id = $1 and excluido_em is null',
    [Number(id)],
  );
  if (!r.rowCount) throw invalido('Cliente não encontrado.');
}

/**
 * Venda: a assinatura nasce aguardando o pagamento da comanda aberta por
 * `abrirComanda` (o caixa monta o item "Pacote: <nome>" com o preço do catálogo).
 */
export async function venderPacote(
  c,
  barbeariaId,
  { clienteId, pacoteId, barbeiroId },
  abrirComanda,
) {
  if (!clienteId) throw invalido('Escolha o cliente.');
  await exigirCliente(c, clienteId);
  if (!pacoteId) throw invalido('Escolha o pacote.');
  const pacote = await buscarPacote(c, pacoteId);
  const comanda = await abrirComanda({
    clienteId: Number(clienteId),
    barbeiroId,
    itens: [{ tipo: 'pacote', refId: pacote.id }],
  });
  const {
    rows: [{ id }],
  } = await c.query(
    `insert into assinaturas (barbearia_id, cliente_id, pacote_id, comanda_venda_id)
     values ($1, $2, $3, $4) returning id`,
    [barbeariaId, Number(clienteId), pacote.id, comanda.id],
  );
  return { id, comandaId: comanda.id };
}

/**
 * Renovação do pacote mensal (decisões 1 a 3 do detalhe da etapa B): uma linha
 * nova ligada à anterior, aguardando o pagamento; o ciclo é contado ao pagar.
 */
export async function renovarPacote(
  c,
  barbeariaId,
  id,
  { barbeiroId },
  abrirComanda,
) {
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
  const {
    rows: [pendente],
  } = await c.query(
    "select estado from assinaturas where renovacao_de = $1 and estado <> 'cancelada'",
    [anterior.id],
  );
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
  const {
    rows: [{ id: nova }],
  } = await c.query(
    `insert into assinaturas (barbearia_id, cliente_id, pacote_id, comanda_venda_id, renovacao_de)
     values ($1, $2, $3, $4, $5) returning id`,
    [barbeariaId, anterior.clienteId, pacote.id, comanda.id, anterior.id],
  );
  return { id: nova, comandaId: comanda.id };
}

/**
 * Confere os usos de pacote dos itens (os da própria comanda contam juntos).
 * Com `travar`, trava as assinaturas antes de ler os usos (receber).
 */
export async function conferirUsos(
  c,
  itens,
  clienteId,
  hoje,
  { travar = false } = {},
) {
  const doPacote = itens.filter((i) => i.assinaturaId);
  if (!doPacote.length) return;
  const ids = [...new Set(doPacote.map((i) => Number(i.assinaturaId)))].sort(
    (a, b) => a - b,
  );
  const assinaturas = new Map();
  for (const id of ids)
    assinaturas.set(id, await buscarAssinatura(c, id, { travar }));
  const usos = await usosDe(c, ids);
  const pacotes = new Map();
  const pendentes = new Map();
  for (const item of doPacote) {
    const a = assinaturas.get(Number(item.assinaturaId));
    if (a.clienteId !== clienteId)
      throw invalido('Esse pacote é de outro cliente.');
    if (a.estado !== 'ativa')
      throw invalido('Esse pacote ainda não foi pago ou foi cancelado.');
    if (!pacotes.has(a.pacoteId))
      pacotes.set(
        a.pacoteId,
        await buscarPacote(c, a.pacoteId, { excluidos: true }),
      );
    const pacote = pacotes.get(a.pacoteId);
    const ja = pendentes.get(a.id) ?? [];
    const r = podeUsarPacote({
      pacote,
      assinatura: {
        ...a,
        usos: [...usos.filter((u) => u.assinaturaId === a.id), ...ja],
      },
      servicoId: Number(item.refId),
      data: hoje,
    });
    if (!r.ok) throw invalido(r.motivo);
    pendentes.set(a.id, [...ja, { servicoId: Number(item.refId), data: hoje }]);
  }
}

/**
 * Comanda que vende ou renova um pacote: o item e o cliente não mudam; para
 * desistir, cancela-se a comanda (issue #22).
 */
export async function conferirVendaPendente(c, comandaId, itens, clienteId) {
  const { rows } = await c.query(
    `select pacote_id as "pacoteId", cliente_id as "clienteId" from assinaturas
      where comanda_venda_id = $1 and estado = 'aguardando_pagamento'`,
    [Number(comandaId)],
  );
  for (const v of rows)
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
  c,
  { assinaturaId, servicoId, jaNaComanda = [] },
  hoje,
) {
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
      usos: [
        ...usos,
        ...jaNaComanda.map((sid) => ({ servicoId: Number(sid), data: hoje })),
      ],
    },
    servicoId: Number(servicoId),
    data: hoje,
  });
}

/**
 * Ao receber a comanda (na mesma transação): grava os usos, conferidos de novo
 * com as assinaturas travadas, e ativa a venda ou a renovação paga nela.
 */
export async function pacotesAoReceber(c, barbeariaId, cm, hoje) {
  await conferirUsos(c, cm.itens, cm.clienteId, hoje, { travar: true });
  for (const item of cm.itens.filter((i) => i.assinaturaId))
    await c.query(
      `insert into usos_assinatura (barbearia_id, assinatura_id, servico_id, data, comanda_id)
       values ($1, $2, $3, $4, $5)`,
      [barbeariaId, Number(item.assinaturaId), Number(item.refId), hoje, cm.id],
    );

  const { rows: vendas } = await c.query(
    `${SELECT_ASSINATURA} where comanda_venda_id = $1 and estado = 'aguardando_pagamento'
      order by id for update`,
    [cm.id],
  );
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
    const { inicio, fim } = anterior
      ? cicloDaRenovacao(pacote, anterior, hoje)
      : vigenciaDoPacote(pacote, hoje);
    await c.query(
      "update assinaturas set estado = 'ativa', inicio = $2, fim = $3 where id = $1",
      [a.id, inicio, fim],
    );
  }
}

/** Comanda cancelada: a venda ou renovação que esperava por ela é cancelada. */
export async function pacotesAoCancelar(c, comandaId) {
  await c.query(
    `update assinaturas set estado = 'cancelada'
      where comanda_venda_id = $1 and estado = 'aguardando_pagamento'`,
    [comandaId],
  );
}
