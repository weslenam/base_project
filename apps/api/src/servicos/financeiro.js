import {
  movimentoDaBaixa,
  situacaoDaConta,
  validarBaixa,
  validarConta,
} from '@barbertime/dominio';
import { conflito, invalido, naoEncontrado } from '../infra/erros.js';
import { garantirCategoriasPadrao } from './estoque.js';

// Contas a pagar e a receber e categorias (planejamento 0027, parte 2, fatia
// 2A). Tudo roda no contexto da barbearia (RLS). A baixa com "dinheiro do
// caixa" vira saída ou entrada na gaveta do caixa de hoje; o estorno desfaz,
// só com aquele caixa ainda aberto.

// ---- categorias ----

const SELECT_CATEGORIA = `
  select cf.id, cf.tipo, cf.nome, cf.ativa,
         exists (select 1 from contas ct where ct.categoria_id = cf.id) as "emUso"
    from categorias_financeiras cf`;

export async function listarCategorias(c, barbeariaId) {
  // As padrão nascem só na primeira vez: excluída ou renomeada não volta
  // (issue #25).
  const ja = await c.query('select 1 from categorias_financeiras limit 1');
  if (!ja.rowCount) await garantirCategoriasPadrao(c, barbeariaId);
  const { rows } = await c.query(
    `${SELECT_CATEGORIA} order by cf.tipo, lower(cf.nome)`,
  );
  return rows;
}

async function buscarCategoria(c, id) {
  const {
    rows: [cat],
  } = await c.query(`${SELECT_CATEGORIA} where cf.id = $1`, [Number(id)]);
  if (!cat) throw naoEncontrado('Categoria não encontrada.');
  return cat;
}

export async function salvarCategoria(c, barbeariaId, dados = {}) {
  const nome = String(dados.nome ?? '').trim();
  if (!nome) throw invalido('Informe o nome da categoria.');
  if (nome.length > 80) throw invalido('O nome está muito longo.');
  const id = dados.id ? Number(dados.id) : null;
  const atual = id ? await buscarCategoria(c, id) : null;
  const tipo = atual?.tipo ?? dados.tipo;
  if (!['pagar', 'receber'].includes(tipo))
    throw invalido('Escolha se a categoria é de contas a pagar ou a receber.');
  const ativa = dados.ativa ?? atual?.ativa ?? true;
  try {
    if (id) {
      await c.query(
        'update categorias_financeiras set nome = $2, ativa = $3 where id = $1',
        [id, nome, Boolean(ativa)],
      );
      return buscarCategoria(c, id);
    }
    const {
      rows: [nova],
    } = await c.query(
      `insert into categorias_financeiras (barbearia_id, tipo, nome) values ($1, $2, $3)
       returning id`,
      [barbeariaId, tipo, nome],
    );
    return buscarCategoria(c, nova.id);
  } catch (erro) {
    if (erro.code === '23505')
      throw conflito(`Já existe uma categoria chamada "${nome}".`);
    throw erro;
  }
}

/** Categoria com conta não se exclui: só se desativa. */
export async function excluirCategoria(c, id) {
  const cat = await buscarCategoria(c, id);
  if (cat.emUso)
    throw conflito(
      `A categoria "${cat.nome}" tem contas: desative em vez de excluir.`,
    );
  await c.query('delete from categorias_financeiras where id = $1', [cat.id]);
}

// ---- contas ----

const SELECT_CONTA = `
  select ct.id, ct.tipo, ct.descricao, ct.categoria_id as "categoriaId",
         cf.nome as "categoriaNome", ct.valor, ct.vencimento,
         ct.fornecedor_id as "fornecedorId", f.nome as "fornecedorNome",
         ct.cliente_id as "clienteId", cl.nome as "clienteNome",
         ct.compra_id as "compraId", ct.parcela, ct.parcelas, ct.origem,
         ct.situacao, ct.pago_em as "pagoEm", ct.valor_pago as "valorPago", ct.forma
    from contas ct
    join categorias_financeiras cf on cf.id = ct.categoria_id
    left join fornecedores f on f.id = ct.fornecedor_id
    left join clientes cl on cl.id = ct.cliente_id`;

const completar = (hoje) => (conta) => ({
  ...conta,
  situacaoAtual: situacaoDaConta(conta, hoje),
});

/**
 * Contas com filtros: tipo (pagar|receber), situacao (aberta, vencida,
 * quitada, cancelada, todas; vazio = todas menos canceladas) e período de
 * vencimento.
 */
export async function listarContas(c, filtros, hoje) {
  const onde = [];
  const valores = [];
  const param = (v) => {
    valores.push(v);
    return `$${valores.length}`;
  };
  if (filtros.tipo) onde.push(`ct.tipo = ${param(filtros.tipo)}`);
  if (filtros.de) onde.push(`ct.vencimento >= ${param(filtros.de)}`);
  if (filtros.ate) onde.push(`ct.vencimento <= ${param(filtros.ate)}`);
  switch (filtros.situacao) {
    case 'vencida':
      onde.push(`ct.situacao = 'aberta' and ct.vencimento < ${param(hoje)}`);
      break;
    case 'aberta':
    case 'quitada':
    case 'cancelada':
      onde.push(`ct.situacao = ${param(filtros.situacao)}`);
      break;
    case 'todas':
      onde.push('true');
      break;
    default:
      onde.push("ct.situacao <> 'cancelada'");
  }
  const { rows } = await c.query(
    `${SELECT_CONTA} where ${onde.join(' and ')} order by ct.vencimento, ct.id limit 500`,
    valores,
  );
  return rows.map(completar(hoje));
}

async function buscarConta(c, id, { travar = false } = {}) {
  const {
    rows: [conta],
  } = await c.query(
    `${SELECT_CONTA} where ct.id = $1${travar ? ' for update of ct' : ''}`,
    [Number(id)],
  );
  if (!conta) throw naoEncontrado('Conta não encontrada.');
  return conta;
}

export async function obterConta(c, id, hoje) {
  return completar(hoje)(await buscarConta(c, id));
}

/** Categoria ativa e do mesmo tipo da conta (a RLS limita à barbearia). */
async function exigirCategoria(c, id, tipo) {
  const {
    rows: [cat],
  } = await c.query(
    'select tipo, ativa from categorias_financeiras where id = $1',
    [Number(id)],
  );
  if (!cat) throw invalido('Categoria não encontrada.');
  if (cat.tipo !== tipo)
    throw invalido(
      `Essa categoria é de contas a ${cat.tipo === 'pagar' ? 'pagar' : 'receber'}.`,
    );
  if (!cat.ativa) throw invalido('Essa categoria está desativada.');
}

async function exigirReferencia(c, tabela, id, mensagem) {
  if (!id) return null;
  const r = await c.query(
    `select 1 from ${tabela} where id = $1 and excluido_em is null`,
    [Number(id)],
  );
  if (!r.rowCount) throw invalido(mensagem);
  return Number(id);
}

const dadosDaConta = (dados, tipo) => ({
  tipo,
  descricao: String(dados.descricao ?? '').trim(),
  categoriaId: dados.categoriaId ? Number(dados.categoriaId) : null,
  valor: Number(dados.valor),
  vencimento: dados.vencimento ?? '',
});

/** Lançamento manual: fornecedor só a pagar, cliente só a receber. */
export async function criarConta(c, barbeariaId, dados = {}, hoje) {
  const conta = dadosDaConta(dados, dados.tipo);
  const motivo = validarConta(conta);
  if (motivo) throw invalido(motivo);
  if (conta.descricao.length > 200)
    throw invalido('A descrição está muito longa.');
  await exigirCategoria(c, conta.categoriaId, conta.tipo);
  const fornecedorId =
    conta.tipo === 'pagar'
      ? await exigirReferencia(
          c,
          'fornecedores',
          dados.fornecedorId,
          'Fornecedor não encontrado.',
        )
      : null;
  const clienteId =
    conta.tipo === 'receber'
      ? await exigirReferencia(
          c,
          'clientes',
          dados.clienteId,
          'Cliente não encontrado.',
        )
      : null;
  const {
    rows: [nova],
  } = await c.query(
    `insert into contas (barbearia_id, tipo, descricao, categoria_id, valor, vencimento,
                         fornecedor_id, cliente_id, origem)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'manual') returning id`,
    [
      barbeariaId,
      conta.tipo,
      conta.descricao,
      conta.categoriaId,
      conta.valor,
      conta.vencimento,
      fornecedorId,
      clienteId,
    ],
  );
  return obterConta(c, nova.id, hoje);
}

/**
 * Edita a conta aberta (decisão 5): descrição, categoria, valor, vencimento e
 * fornecedor ou cliente. A parcela de compra só muda o vencimento.
 */
export async function editarConta(c, id, dados = {}, hoje) {
  const atual = await buscarConta(c, id, { travar: true });
  if (atual.situacao !== 'aberta')
    throw conflito('Só dá para alterar uma conta em aberto.');
  if (atual.origem === 'compra') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.vencimento ?? ''))
      throw invalido('Informe o vencimento.');
    await c.query('update contas set vencimento = $2 where id = $1', [
      atual.id,
      dados.vencimento,
    ]);
    return obterConta(c, atual.id, hoje);
  }
  const conta = dadosDaConta(dados, atual.tipo);
  const motivo = validarConta(conta);
  if (motivo) throw invalido(motivo);
  if (conta.descricao.length > 200)
    throw invalido('A descrição está muito longa.');
  if (conta.categoriaId !== atual.categoriaId)
    await exigirCategoria(c, conta.categoriaId, conta.tipo);
  // Fornecedor ou cliente que já estava na conta fica, mesmo excluído depois
  // (issue #27); só um novo precisa estar ativo.
  const referencia = async (campo, tabela, mensagem) => {
    const id = dados[campo] ? Number(dados[campo]) : null;
    if (id === atual[campo]) return id;
    return exigirReferencia(c, tabela, id, mensagem);
  };
  const fornecedorId =
    atual.tipo === 'pagar'
      ? await referencia(
          'fornecedorId',
          'fornecedores',
          'Fornecedor não encontrado.',
        )
      : null;
  const clienteId =
    atual.tipo === 'receber'
      ? await referencia('clienteId', 'clientes', 'Cliente não encontrado.')
      : null;
  await c.query(
    `update contas set descricao = $2, categoria_id = $3, valor = $4, vencimento = $5,
       fornecedor_id = $6, cliente_id = $7 where id = $1`,
    [
      atual.id,
      conta.descricao,
      conta.categoriaId,
      conta.valor,
      conta.vencimento,
      fornecedorId,
      clienteId,
    ],
  );
  return obterConta(c, atual.id, hoje);
}

/** Cancela a conta aberta. A parcela de compra sai junto com a compra. */
export async function cancelarConta(c, id, hoje) {
  const conta = await buscarConta(c, id, { travar: true });
  if (conta.situacao !== 'aberta')
    throw conflito('Só dá para cancelar uma conta em aberto.');
  if (conta.origem === 'compra')
    throw conflito(
      'Esta é uma parcela de compra: para desistir, cancele a compra.',
    );
  await c.query("update contas set situacao = 'cancelada' where id = $1", [
    conta.id,
  ]);
  return obterConta(c, conta.id, hoje);
}

/**
 * Baixa (pagar ou receber). Com "dinheiro do caixa", a data é hoje e o valor
 * vira saída ou entrada no caixa de hoje, que precisa estar aberto.
 */
export async function baixarConta(
  c,
  barbeariaId,
  id,
  dados = {},
  { hoje, usuarioId },
) {
  const conta = await buscarConta(c, id, { travar: true });
  if (conta.situacao !== 'aberta')
    throw conflito(
      conta.situacao === 'quitada'
        ? 'Esta conta já foi paga.'
        : 'Esta conta foi cancelada.',
    );
  const baixa = {
    // Dinheiro do caixa sem data: é hoje (data da barbearia, não do aparelho).
    data: dados.data || (dados.forma === 'dinheiro_caixa' ? hoje : ''),
    valorPago: Number(dados.valorPago ?? conta.valor),
    forma: dados.forma,
  };
  const motivo = validarBaixa(baixa);
  if (motivo) throw invalido(motivo);
  if (baixa.data > hoje)
    throw invalido('A data do pagamento não pode ser depois de hoje.');
  const movimento = movimentoDaBaixa(conta, baixa);
  if (movimento) {
    if (baixa.data !== hoje)
      throw invalido(
        'Com dinheiro do caixa, a data é hoje: o valor sai da gaveta de hoje.',
      );
    // Trava o caixa contra o fechamento ao mesmo tempo (issue #28).
    const {
      rows: [caixa],
    } = await c.query(
      'select id, aberto from caixas where data = $1 for update',
      [hoje],
    );
    if (!caixa?.aberto)
      throw conflito(
        'Abra o caixa de hoje ou escolha outra forma de pagamento.',
      );
    await c.query(
      `insert into movimentos_caixa (barbearia_id, caixa_id, tipo, valor, descricao, conta_id, criado_por)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        barbeariaId,
        caixa.id,
        movimento.tipo,
        movimento.valor,
        movimento.descricao.slice(0, 200),
        conta.id,
        usuarioId ?? null,
      ],
    );
  }
  await c.query(
    `update contas set situacao = 'quitada', pago_em = $2, valor_pago = $3, forma = $4
      where id = $1`,
    [conta.id, baixa.data, baixa.valorPago, baixa.forma],
  );
  return obterConta(c, conta.id, hoje);
}

/**
 * Estorno da baixa: a conta volta a ficar aberta. Se saiu ou entrou dinheiro
 * da gaveta, aquele caixa precisa estar aberto (decisão 3); as outras formas
 * estornam a qualquer momento.
 */
export async function estornarBaixa(c, id, hoje) {
  const conta = await buscarConta(c, id, { travar: true });
  if (conta.situacao !== 'quitada')
    throw conflito('Só dá para estornar uma conta paga.');
  const {
    rows: [mov],
  } = await c.query(
    `select m.id, cx.aberto from movimentos_caixa m join caixas cx on cx.id = m.caixa_id
      where m.conta_id = $1 and m.estornado_em is null for update of m`,
    [conta.id],
  );
  if (mov) {
    if (!mov.aberto)
      throw conflito(
        'O caixa em que esse dinheiro saiu já foi fechado: não dá para estornar.',
      );
    await c.query(
      'update movimentos_caixa set estornado_em = now() where id = $1',
      [mov.id],
    );
  }
  await c.query(
    `update contas set situacao = 'aberta', pago_em = null, valor_pago = null, forma = null
      where id = $1`,
    [conta.id],
  );
  return obterConta(c, conta.id, hoje);
}
