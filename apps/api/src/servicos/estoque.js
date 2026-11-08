import {
  arredondarQuantidade,
  baixasDaComanda,
  motivoParcelasInvalidas,
  totalDaCompra,
} from '@barbertime/dominio';
import { conflito, invalido, naoEncontrado } from '../infra/erros.js';

// Estoque e compras (planejamento 0027, parte 1). Sempre numa transação com RLS (c).
// O saldo fica em produtos.saldo e muda só aqui, junto com o movimento.

export const SELECT_PRODUTO_ESTOQUE = `
  select id, nome, tipo, unidade, preco, estoque_minimo as "estoqueMinimo",
         ultimo_custo as "ultimoCusto", saldo
    from produtos`;

/** Categorias iniciais do financeiro (criadas na primeira necessidade). */
export const CATEGORIAS_PADRAO = Object.freeze({
  pagar: [
    'Aluguel',
    'Energia',
    'Água',
    'Internet',
    'Compra de produtos',
    'Salários e pró-labore',
    'Impostos',
    'Outras despesas',
  ],
  receber: ['Aluguel de cadeira', 'Outras receitas'],
});

export async function garantirCategoriasPadrao(c, barbeariaId) {
  for (const [tipo, nomes] of Object.entries(CATEGORIAS_PADRAO))
    for (const nome of nomes)
      await c.query(
        `insert into categorias_financeiras (barbearia_id, tipo, nome) values ($1, $2, $3)
         on conflict (barbearia_id, tipo, lower(nome)) do nothing`,
        [barbeariaId, tipo, nome],
      );
}

export async function moduloAtivo(c, chave) {
  const r = await c.query(
    "select 1 from barbearia_modulos where modulo = $1 and estado = 'ativo'",
    [chave],
  );
  return r.rowCount > 0;
}

/**
 * Produto travado para mudar o saldo. Só produto ativo, exceto no estorno de
 * compra: desfazer uma entrada real vale mesmo se o produto saiu do cadastro.
 */
async function travarProduto(c, id, { incluirExcluido = false } = {}) {
  const {
    rows: [p],
  } = await c.query(
    `${SELECT_PRODUTO_ESTOQUE} where id = $1${incluirExcluido ? '' : ' and excluido_em is null'} for update`,
    [Number(id)],
  );
  if (!p) throw invalido('Produto não encontrado.');
  return p;
}

/**
 * Registra um movimento e atualiza o saldo (quantidade com sinal).
 * Saldo negativo é permitido: a venda nunca trava por causa do estoque.
 */
export async function movimentar(
  c,
  barbeariaId,
  {
    produtoId,
    tipo,
    quantidade,
    custoUnitario = null,
    motivo = '',
    comandaId = null,
    compraId = null,
    usuarioId = null,
    incluirExcluido = false,
  },
) {
  const qtd = arredondarQuantidade(quantidade);
  if (!qtd) return null;
  const p = await travarProduto(c, produtoId, { incluirExcluido });
  await c.query(
    `insert into movimentos_estoque
       (barbearia_id, produto_id, tipo, quantidade, custo_unitario, motivo, comanda_id, compra_id, usuario_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      barbeariaId,
      p.id,
      tipo,
      qtd,
      custoUnitario,
      motivo,
      comandaId,
      compraId,
      usuarioId,
    ],
  );
  await c.query('update produtos set saldo = saldo + $2 where id = $1', [
    p.id,
    qtd,
  ]);
  return { ...p, saldo: arredondarQuantidade(Number(p.saldo) + qtd) };
}

/** Comanda paga: baixa a revenda vendida e os consumíveis das fichas técnicas. */
export async function baixarComanda(c, barbeariaId, comanda, usuarioId) {
  if (!(await moduloAtivo(c, 'estoque'))) return [];
  const itens = comanda.itens ?? [];
  const servicos = itens
    .filter((i) => i.tipo === 'servico')
    .map((i) => Number(i.refId));
  const { rows: fichas } = await c.query(
    `select servico_id as "servicoId", produto_id as "produtoId", quantidade
       from fichas_tecnicas where servico_id = any($1::bigint[])`,
    [servicos],
  );
  const ids = [
    ...itens.filter((i) => i.tipo === 'produto').map((i) => Number(i.refId)),
    ...fichas.map((f) => Number(f.produtoId)),
  ];
  const { rows } = await c.query(
    'select id, tipo from produtos where id = any($1::bigint[]) and excluido_em is null',
    [ids],
  );
  const produtos = new Map(rows.map((p) => [Number(p.id), p]));
  const baixas = baixasDaComanda({
    itens: itens.map((i) => ({ ...i, refId: Number(i.refId) })),
    fichas: fichas.map((f) => ({
      servicoId: Number(f.servicoId),
      produtoId: Number(f.produtoId),
      quantidade: Number(f.quantidade),
    })),
    produtos,
  });
  // Sempre na ordem do id: travas na mesma ordem em todo caminho, sem impasse.
  baixas.sort((a, b) => a.produtoId - b.produtoId);
  for (const b of baixas)
    await movimentar(c, barbeariaId, {
      ...b,
      comandaId: comanda.id,
      usuarioId,
    });
  return baixas;
}

// ---- compras ----

export const SELECT_COMPRA = `
  select cp.id, cp.data, cp.fornecedor_id as "fornecedorId", f.nome as "fornecedorNome",
         cp.frete, cp.desconto, cp.total, cp.observacao,
         cp.cancelada_em is not null as cancelada
    from compras cp join fornecedores f on f.id = cp.fornecedor_id`;

export async function obterCompra(c, id) {
  const {
    rows: [compra],
  } = await c.query(`${SELECT_COMPRA} where cp.id = $1`, [Number(id)]);
  if (!compra) throw naoEncontrado('Compra não encontrada.');
  const { rows: itens } = await c.query(
    `select i.produto_id as "produtoId", p.nome, p.unidade, i.quantidade,
            i.custo_unitario as "custoUnitario"
       from itens_compra i join produtos p on p.id = i.produto_id
      where i.compra_id = $1 order by i.id`,
    [compra.id],
  );
  const { rows: parcelas } = await c.query(
    `select id, parcela, parcelas, valor, vencimento, situacao, pago_em as "pagoEm"
       from contas where compra_id = $1 order by parcela`,
    [compra.id],
  );
  return { ...compra, itens, parcelas };
}

/**
 * Registra a compra já recebida: entrada no estoque (com último custo) e as
 * parcelas a pagar. Tudo ou nada (mesma transação).
 */
export async function registrarCompra(c, barbeariaId, usuarioId, dados) {
  const fornecedorId = Number(dados.fornecedorId);
  if (!Number.isInteger(fornecedorId) || fornecedorId <= 0)
    throw invalido('Escolha o fornecedor da compra.');
  const {
    rows: [fornecedor],
  } = await c.query(
    'select nome from fornecedores where id = $1 and excluido_em is null',
    [fornecedorId],
  );
  if (!fornecedor) throw invalido('Escolha o fornecedor da compra.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dados.data ?? '')))
    throw invalido('Informe a data da compra.');
  const itens = (dados.itens ?? []).map((i) => ({
    produtoId: Number(i.produtoId),
    quantidade: arredondarQuantidade(i.quantidade),
    custoUnitario: Math.round(Number(i.custoUnitario) * 100) / 100,
  }));
  if (!itens.length) throw invalido('Inclua ao menos um produto na compra.');
  if (
    itens.some(
      (i) => !i.produtoId || !(i.quantidade > 0) || !(i.custoUnitario >= 0),
    )
  )
    throw invalido('Cada item precisa de produto, quantidade e custo.');
  const frete = Number(dados.frete || 0);
  const desconto = Number(dados.desconto || 0);
  if (!(frete >= 0) || !(desconto >= 0))
    throw invalido('Frete e desconto não podem ser negativos.');
  const { total, motivo } = totalDaCompra({ itens, frete, desconto });
  if (motivo) throw invalido(motivo);
  const parcelas = (dados.parcelas ?? []).map((p) => ({
    valor: Math.round(Number(p.valor) * 100) / 100,
    vencimento: String(p.vencimento ?? ''),
  }));
  if (total > 0) {
    const motivoParcelas = motivoParcelasInvalidas(parcelas, total);
    if (motivoParcelas) throw invalido(motivoParcelas);
    if (parcelas.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.vencimento)))
      throw invalido('Informe o vencimento de cada parcela.');
  }

  const {
    rows: [compra],
  } = await c.query(
    `insert into compras (barbearia_id, fornecedor_id, data, frete, desconto, total, observacao, criada_por)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [
      barbeariaId,
      fornecedorId,
      dados.data,
      frete,
      desconto,
      total,
      String(dados.observacao ?? '').slice(0, 2000),
      usuarioId,
    ],
  );
  itens.sort((a, b) => a.produtoId - b.produtoId); // travas na ordem do id
  for (const i of itens) {
    // Valida o produto (ativo, desta barbearia) e trava antes de inserir.
    await movimentar(c, barbeariaId, {
      produtoId: i.produtoId,
      tipo: 'compra',
      quantidade: i.quantidade,
      custoUnitario: i.custoUnitario,
      compraId: compra.id,
      usuarioId,
    });
    await c.query(
      `insert into itens_compra (barbearia_id, compra_id, produto_id, quantidade, custo_unitario)
       values ($1, $2, $3, $4, $5)`,
      [barbeariaId, compra.id, i.produtoId, i.quantidade, i.custoUnitario],
    );
  }
  // Último custo = o da compra válida mais recente pela data (compra lançada
  // com data antiga não sobrescreve o custo de uma mais nova), igual ao cancelamento.
  await c.query(
    `update produtos p set ultimo_custo = (
       select i.custo_unitario from itens_compra i join compras cp on cp.id = i.compra_id
        where i.produto_id = p.id and cp.cancelada_em is null
        order by cp.data desc, cp.id desc limit 1)
      where p.id in (select produto_id from itens_compra where compra_id = $1)`,
    [compra.id],
  );
  if (total > 0) {
    await garantirCategoriasPadrao(c, barbeariaId);
    const {
      rows: [categoria],
    } = await c.query(
      "select id from categorias_financeiras where tipo = 'pagar' and lower(nome) = 'compra de produtos'",
    );
    for (const [n, p] of parcelas.entries())
      await c.query(
        `insert into contas (barbearia_id, tipo, descricao, categoria_id, valor, vencimento,
                             fornecedor_id, compra_id, parcela, parcelas, origem)
         values ($1, 'pagar', $2, $3, $4, $5, $6, $7, $8, $9, 'compra')`,
        [
          barbeariaId,
          `Compra #${compra.id} · ${fornecedor.nome}`,
          categoria.id,
          p.valor,
          p.vencimento,
          fornecedorId,
          compra.id,
          n + 1,
          parcelas.length,
        ],
      );
  }
  return obterCompra(c, compra.id);
}

/** Cancela a compra: estorna o estoque e as parcelas, se nenhuma foi paga. */
export async function cancelarCompra(c, barbeariaId, usuarioId, id) {
  const {
    rows: [cp],
  } = await c.query(
    'select id, cancelada_em from compras where id = $1 for update',
    [Number(id)],
  );
  if (!cp) throw naoEncontrado('Compra não encontrada.');
  if (cp.cancelada_em) throw conflito('Essa compra já foi cancelada.');
  const paga = await c.query(
    "select 1 from contas where compra_id = $1 and situacao = 'quitada'",
    [cp.id],
  );
  if (paga.rowCount)
    throw conflito(
      'Essa compra já tem parcela paga. Estorne o pagamento antes de cancelar.',
    );
  const { rows: itens } = await c.query(
    'select produto_id as "produtoId", quantidade, custo_unitario as "custoUnitario" from itens_compra where compra_id = $1 order by produto_id',
    [cp.id],
  );
  for (const i of itens)
    await movimentar(c, barbeariaId, {
      produtoId: i.produtoId,
      tipo: 'estorno_compra',
      incluirExcluido: true,
      quantidade: -Number(i.quantidade),
      custoUnitario: i.custoUnitario,
      compraId: cp.id,
      usuarioId,
    });
  // O último custo volta ao da compra válida mais recente (ou fica vazio).
  await c.query(
    `update produtos p set ultimo_custo = (
       select i.custo_unitario from itens_compra i join compras cp on cp.id = i.compra_id
        where i.produto_id = p.id and cp.cancelada_em is null and cp.id <> $1
        order by cp.data desc, cp.id desc limit 1)
      where p.id in (select produto_id from itens_compra where compra_id = $1)`,
    [cp.id],
  );
  await c.query(
    "update contas set situacao = 'cancelada' where compra_id = $1 and situacao = 'aberta'",
    [cp.id],
  );
  await c.query('update compras set cancelada_em = now() where id = $1', [
    cp.id,
  ]);
  return obterCompra(c, cp.id);
}
