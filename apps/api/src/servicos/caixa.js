import {
  diferencaDeCaixa,
  motivoParaNaoReceber,
  resumoDoCaixa,
  totalDaComanda,
} from '@barbertime/dominio';
import { conflito, invalido, naoEncontrado } from '../infra/erros.js';
import { agora } from './agenda.js';

// Caixa do dia e comandas (planejamento 0020, fase 1). A comanda nasce no
// check-in ou na entrada na fila e acompanha o atendimento até o pagamento.
// Pacotes e fidelidade entram com a parte 3 do planejamento 0019.

const SELECT_CAIXA = `
  select id, data, valor_inicial as "valorInicial", aberto, aberto_as as "abertoAs",
         fechado_as as "fechadoAs", dinheiro_contado as "dinheiroContado", diferenca
    from caixas`;

export const SELECT_COMANDA = `
  select cm.id, cm.caixa_id as "caixaId", cx.data, cm.atendimento_id as "atendimentoId",
         cm.cliente_id as "clienteId", cm.barbeiro_id as "barbeiroId", cm.hora,
         cm.itens, cm.desconto, cm.forma, cm.estado, cm.paga_as as "pagaAs",
         coalesce(cl.nome, a.cliente_nome, 'Cliente avulso') as "clienteNome",
         coalesce(b.nome, '') as "barbeiroNome"
    from comandas cm
    join caixas cx on cx.id = cm.caixa_id
    left join clientes cl on cl.id = cm.cliente_id
    left join barbeiros b on b.id = cm.barbeiro_id
    left join atendimentos a on a.id = cm.atendimento_id`;

/** Comanda com os totais (serviços, produtos, subtotal, desconto, total). */
export const completarComanda = (c) => ({ ...c, ...totalDaComanda(c) });

export async function caixaDoDia(c, data = agora().data) {
  const {
    rows: [caixa],
  } = await c.query(`${SELECT_CAIXA} where data = $1`, [data]);
  return caixa ?? null;
}

export async function exigirCaixaAberto(c) {
  const caixa = await caixaDoDia(c);
  if (!caixa?.aberto)
    throw conflito('Abra o caixa de hoje antes de lançar comandas.');
  return caixa;
}

export async function comandasDoCaixa(c, caixaId) {
  const { rows } = await c.query(
    `${SELECT_COMANDA} where cm.caixa_id = $1 order by cm.hora desc, cm.id desc`,
    [caixaId],
  );
  return rows.map(completarComanda);
}

export async function obterComanda(c, id, { travar = false } = {}) {
  const {
    rows: [cm],
  } = await c.query(
    `${SELECT_COMANDA} where cm.id = $1${travar ? ' for update of cm' : ''}`,
    [Number(id)],
  );
  if (!cm) throw naoEncontrado('Comanda não encontrada.');
  return completarComanda(cm);
}

/**
 * Trava a comanda para mudar o estado. Sempre na mesma ordem (atendimento,
 * depois comanda), como as rotas do balcão, para não haver impasse.
 */
async function travarComanda(c, id) {
  const cm = await obterComanda(c, id);
  if (cm.atendimentoId)
    await c.query('select 1 from atendimentos where id = $1 for update', [
      cm.atendimentoId,
    ]);
  return obterComanda(c, cm.id, { travar: true });
}

/**
 * Comanda que ficou aberta num caixa de outro dia passa para o caixa de hoje:
 * o dinheiro entra no fechamento de hoje e o caixa antigo pode ser fechado.
 */
async function trazerParaOCaixaDeHoje(c, cm, caixa) {
  if (cm.caixaId === caixa.id) return cm;
  await c.query('update comandas set caixa_id = $2 where id = $1', [
    cm.id,
    caixa.id,
  ]);
  return { ...cm, caixaId: caixa.id };
}

export async function caixaComResumo(c, caixa) {
  if (!caixa) return null;
  const comandas = await comandasDoCaixa(c, caixa.id);
  return {
    ...caixa,
    resumo: resumoDoCaixa({ valorInicial: caixa.valorInicial, comandas }),
  };
}

export async function abrirCaixa(c, barbeariaId, { valorInicial }) {
  const atual = await caixaDoDia(c);
  if (atual?.aberto) throw conflito('O caixa de hoje já está aberto.');
  if (atual)
    throw conflito('O caixa de hoje já foi fechado. Ele reabre amanhã.');
  if (
    !(Number(valorInicial) >= 0) ||
    valorInicial === null ||
    valorInicial === ''
  )
    throw invalido('Informe o troco inicial (pode ser zero).');
  const { data, hora } = agora();
  await c.query(
    'insert into caixas (barbearia_id, data, valor_inicial, aberto_as) values ($1, $2, $3, $4)',
    [barbeariaId, data, Number(valorInicial), hora],
  );
  return caixaComResumo(c, await caixaDoDia(c));
}

export async function fecharCaixa(c, { dinheiroContado }) {
  const caixa = await exigirCaixaAberto(c);
  const { resumo } = await caixaComResumo(c, caixa);
  if (resumo.abertas) {
    const n = resumo.abertas;
    throw conflito(
      `Há ${n} comanda${n > 1 ? 's' : ''} em aberto. Receba ou cancele antes de fechar o caixa.`,
    );
  }
  if (
    !(Number(dinheiroContado) >= 0) ||
    dinheiroContado === null ||
    dinheiroContado === ''
  )
    throw invalido('Informe quanto dinheiro há na gaveta.');
  await c.query(
    `update caixas set aberto = false, fechado_as = $2, dinheiro_contado = $3, diferenca = $4
      where id = $1`,
    [
      caixa.id,
      agora().hora,
      Number(dinheiroContado),
      diferencaDeCaixa(dinheiroContado, resumo.dinheiroEsperado),
    ],
  );
  return caixaComResumo(c, await caixaDoDia(c));
}

/** Barbeiro ativo desta barbearia (a RLS limita a busca à barbearia). */
async function exigirBarbeiro(c, id) {
  const b = await c.query(
    'select 1 from barbeiros where id = $1 and excluido_em is null',
    [id],
  );
  if (!b.rowCount) throw invalido('Barbeiro não encontrado.');
}

/**
 * Itens com nome e preço do catálogo no momento da venda (base da comissão
 * futura). Nome e preço nunca vêm de quem chama a API.
 */
async function normalizarItens(c, itens = [], barbeiroId) {
  const normalizados = [];
  const conferidos = new Set(barbeiroId ? [barbeiroId] : []);
  for (const i of itens) {
    if (i.tipo === 'pacote' || i.assinaturaId)
      throw invalido(
        'Pacotes ainda não estão disponíveis nesta versão do caixa.',
      );
    const produto = i.tipo === 'produto';
    const {
      rows: [ref],
    } = await c.query(
      `select id, nome, preco from ${produto ? 'produtos' : 'servicos'}
        where id = $1 and excluido_em is null`,
      [Number(i.refId)],
    );
    if (!ref)
      throw invalido(`${produto ? 'Produto' : 'Serviço'} não encontrado.`);
    const doItem = i.barbeiroId ? Number(i.barbeiroId) : null;
    if (doItem && !conferidos.has(doItem)) {
      await exigirBarbeiro(c, doItem);
      conferidos.add(doItem);
    }
    normalizados.push({
      tipo: produto ? 'produto' : 'servico',
      refId: ref.id,
      nome: ref.nome,
      preco: Number(ref.preco),
      quantidade: Math.max(1, Math.round(Number(i.quantidade) || 1)),
      barbeiroId: doItem ?? barbeiroId ?? null,
    });
  }
  return normalizados;
}

/** Cria ou atualiza uma comanda aberta. */
export async function salvarComanda(c, barbeariaId, dados) {
  const caixa = await exigirCaixaAberto(c);
  const barbeiroId = dados.barbeiroId ? Number(dados.barbeiroId) : null;
  if (barbeiroId) {
    await exigirBarbeiro(c, barbeiroId);
  } else if (!dados.atendimentoId && !dados.id) {
    throw invalido('Escolha o barbeiro da comanda.');
  }
  const atendimentoId = dados.atendimentoId
    ? Number(dados.atendimentoId)
    : null;
  if (atendimentoId) {
    // A RLS só enxerga os atendimentos desta barbearia; a chave estrangeira
    // não passa pela RLS, então a conferência é aqui.
    const {
      rows: [a],
    } = await c.query('select estado from atendimentos where id = $1', [
      atendimentoId,
    ]);
    if (!a) throw invalido('Atendimento não encontrado.');
    if (['desistiu', 'no_show', 'cancelado', 'pago'].includes(a.estado))
      throw invalido('Esse atendimento já foi encerrado.');
  }
  const itens = await normalizarItens(c, dados.itens, barbeiroId);
  const desconto = Number(dados.desconto || 0);
  if (!Number.isFinite(desconto))
    throw invalido('Informe o desconto em reais.');
  if (desconto < 0 || desconto > totalDaComanda({ itens }).subtotal)
    throw invalido('O desconto não pode ser maior que o valor da comanda.');
  const clienteId = dados.clienteId ? Number(dados.clienteId) : null;
  if (clienteId) {
    const r = await c.query(
      'select 1 from clientes where id = $1 and excluido_em is null',
      [clienteId],
    );
    if (!r.rowCount) throw invalido('Cliente não encontrado.');
  }

  if (dados.id) {
    const atual = await travarComanda(c, dados.id);
    if (atual.estado !== 'aberta')
      throw conflito('Só dá para alterar comanda em aberto.');
    await trazerParaOCaixaDeHoje(c, atual, caixa);
    await c.query(
      `update comandas set cliente_id = $2, barbeiro_id = coalesce($3, barbeiro_id),
         itens = $4, desconto = $5, forma = $6 where id = $1`,
      [
        atual.id,
        clienteId,
        barbeiroId,
        JSON.stringify(itens),
        desconto,
        dados.forma ?? null,
      ],
    );
    return obterComanda(c, atual.id);
  }
  const {
    rows: [nova],
  } = await c.query(
    `insert into comandas (barbearia_id, caixa_id, atendimento_id, cliente_id, barbeiro_id, hora, itens, desconto, forma)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [
      barbeariaId,
      caixa.id,
      atendimentoId,
      clienteId,
      barbeiroId,
      agora().hora,
      JSON.stringify(itens),
      desconto,
      dados.forma ?? null,
    ],
  );
  return obterComanda(c, nova.id);
}

/** Recebe a comanda; o atendimento ligado vira "pago". */
export async function receberComanda(c, id, { forma } = {}) {
  const caixa = await exigirCaixaAberto(c);
  const cm = await travarComanda(c, id);
  if (cm.estado !== 'aberta') throw conflito('Essa comanda já foi encerrada.');
  await trazerParaOCaixaDeHoje(c, cm, caixa);
  const motivo = motivoParaNaoReceber({ ...cm, forma: forma ?? cm.forma });
  if (motivo) throw invalido(motivo);
  await c.query(
    "update comandas set estado = 'paga', forma = $2, paga_as = $3 where id = $1",
    [cm.id, forma ?? cm.forma, agora().hora],
  );
  if (cm.atendimentoId) {
    await c.query(
      `update atendimentos set estado = 'pago',
         finalizado_em = coalesce(finalizado_em, now()),
         iniciado_em = coalesce(iniciado_em, now())
       where id = $1 and estado in ('agendado', 'chegou', 'na_fila', 'em_atendimento', 'finalizado')`,
      [cm.atendimentoId],
    );
  }
  return { ...(await obterComanda(c, cm.id)), creditos: [] };
}

export async function cancelarComanda(c, id) {
  const cm = await travarComanda(c, id);
  if (cm.estado === 'paga')
    throw conflito('Comanda já recebida não pode ser cancelada.');
  await c.query("update comandas set estado = 'cancelada' where id = $1", [
    cm.id,
  ]);
  return obterComanda(c, cm.id);
}

/**
 * Comanda do atendimento: devolve a existente (não cancelada) ou abre uma nova
 * com cliente, barbeiro e o serviço do atendimento.
 */
export async function comandaDoAtendimento(c, barbeariaId, atendimento) {
  const {
    rows: [existente],
  } = await c.query(
    "select id from comandas where atendimento_id = $1 and estado <> 'cancelada'",
    [atendimento.id],
  );
  if (existente) return obterComanda(c, existente.id);
  // Comanda cancelada antes: libera o vínculo para abrir outra.
  await c.query(
    'update comandas set atendimento_id = null where atendimento_id = $1',
    [atendimento.id],
  );
  return salvarComanda(c, barbeariaId, {
    atendimentoId: atendimento.id,
    clienteId: atendimento.clienteId,
    barbeiroId: atendimento.barbeiroId,
    itens: atendimento.servicoId
      ? [{ tipo: 'servico', refId: atendimento.servicoId }]
      : [],
  });
}
