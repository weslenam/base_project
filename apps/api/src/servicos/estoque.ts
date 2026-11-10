import {
  arredondarQuantidade,
  baixasDaComanda,
  motivoParcelasInvalidas,
  totalDaCompra,
} from '@barbertime/dominio';
import type { Baixa, ItemComanda, Valor } from '@barbertime/dominio';
import { sql } from 'kysely';
import { conflito, invalido, naoEncontrado } from '../infra/erros.ts';
import type { Conexao } from '../infra/banco.ts';
import type { Compra, ProdutoNoEstoque } from '@barbertime/contratos';

// Estoque e compras (planejamento 0027, parte 1). Sempre numa transação com RLS (c).
// O saldo fica em produtos.saldo e muda só aqui, junto com o movimento.

/** Produtos com os campos do estoque (complete com where e order). */
export const selecionarProdutosDoEstoque = (c: Conexao) =>
  c.db
    .selectFrom('produtos')
    .select([
      'id',
      'nome',
      'tipo',
      'unidade',
      'preco',
      'estoqueMinimo',
      'ultimoCusto',
      'saldo',
    ]);

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

export async function garantirCategoriasPadrao(
  c: Conexao,
  barbeariaId: number,
): Promise<void> {
  for (const [tipo, nomes] of Object.entries(CATEGORIAS_PADRAO))
    for (const nome of nomes)
      await c.db
        .insertInto('categoriasFinanceiras')
        .values({ barbeariaId, tipo, nome })
        // O índice único é de expressão (lower(nome)): o alvo vai em `sql`,
        // texto fixo sem dado da requisição.
        .onConflict((oc) =>
          oc.expression(sql`barbearia_id, tipo, lower(nome)`).doNothing(),
        )
        .execute();
}

export async function moduloAtivo(c: Conexao, chave: string): Promise<boolean> {
  const r = await c.db
    .selectFrom('barbeariaModulos')
    .select('modulo')
    .where('modulo', '=', chave)
    .where('estado', '=', 'ativo')
    .execute();
  return r.length > 0;
}

/**
 * Produto travado para mudar o saldo. Só produto ativo, exceto no estorno de
 * compra: desfazer uma entrada real vale mesmo se o produto saiu do cadastro.
 */
async function travarProduto(
  c: Conexao,
  id: number | string,
  { incluirExcluido = false } = {},
): Promise<ProdutoNoEstoque> {
  let consulta = selecionarProdutosDoEstoque(c).where('id', '=', Number(id));
  if (!incluirExcluido) consulta = consulta.where('excluidoEm', 'is', null);
  const p = await consulta.forUpdate().executeTakeFirst();
  if (!p) throw invalido('Produto não encontrado.');
  return p;
}

/** Dados de um movimento de estoque (quantidade com sinal). */
export interface DadosDoMovimento {
  produtoId: number | string;
  tipo: string;
  quantidade: Valor;
  custoUnitario?: number | null;
  motivo?: string;
  comandaId?: number | null;
  compraId?: number | null;
  usuarioId?: number | null;
  incluirExcluido?: boolean;
}

/**
 * Registra um movimento e atualiza o saldo (quantidade com sinal).
 * Saldo negativo é permitido: a venda nunca trava por causa do estoque.
 */
export async function movimentar(
  c: Conexao,
  barbeariaId: number,
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
  }: DadosDoMovimento,
): Promise<ProdutoNoEstoque | null> {
  const qtd = arredondarQuantidade(quantidade);
  if (!qtd) return null;
  const p = await travarProduto(c, produtoId, { incluirExcluido });
  await c.db
    .insertInto('movimentosEstoque')
    .values({
      barbeariaId,
      produtoId: p.id,
      tipo,
      quantidade: qtd,
      custoUnitario,
      motivo,
      comandaId,
      compraId,
      usuarioId,
    })
    .execute();
  await c.db
    .updateTable('produtos')
    .set((eb) => ({ saldo: eb('saldo', '+', qtd) }))
    .where('id', '=', p.id)
    .execute();
  return { ...p, saldo: arredondarQuantidade(Number(p.saldo) + qtd) };
}

/** Comanda paga: baixa a revenda vendida e os consumíveis das fichas técnicas. */
export async function baixarComanda(
  c: Conexao,
  barbeariaId: number,
  comanda: { id: number; itens?: ItemComanda[] },
  usuarioId: number | null | undefined,
): Promise<Baixa[]> {
  if (!(await moduloAtivo(c, 'estoque'))) return [];
  const itens = comanda.itens ?? [];
  const servicos = itens
    .filter((i) => i.tipo === 'servico')
    .map((i) => Number(i.refId));
  // Lista vazia: nada a buscar (o `in ()` vazio não é SQL válido).
  const fichas = servicos.length
    ? await c.db
        .selectFrom('fichasTecnicas')
        .select(['servicoId', 'produtoId', 'quantidade'])
        .where('servicoId', 'in', servicos)
        .execute()
    : [];
  const ids = [
    ...itens.filter((i) => i.tipo === 'produto').map((i) => Number(i.refId)),
    ...fichas.map((f) => Number(f.produtoId)),
  ];
  const linhas = ids.length
    ? await c.db
        .selectFrom('produtos')
        .select(['id', 'tipo'])
        .where('id', 'in', ids)
        .where('excluidoEm', 'is', null)
        .execute()
    : [];
  const produtos = new Map(linhas.map((p) => [Number(p.id), p]));
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

export async function obterCompra(
  c: Conexao,
  id: number | string,
): Promise<Compra> {
  const compra = await c.db
    .selectFrom('compras as cp')
    .innerJoin('fornecedores as f', 'f.id', 'cp.fornecedorId')
    .select([
      'cp.id',
      'cp.data',
      'cp.fornecedorId',
      'f.nome as fornecedorNome',
      'cp.frete',
      'cp.desconto',
      'cp.total',
      'cp.observacao',
    ])
    .select((eb) =>
      // No Postgres a comparação volta boolean (o SqlBool do Kysely cobre outros bancos).
      eb('cp.canceladaEm', 'is not', null).$castTo<boolean>().as('cancelada'),
    )
    .where('cp.id', '=', Number(id))
    .executeTakeFirst();
  if (!compra) throw naoEncontrado('Compra não encontrada.');
  const itens = await c.db
    .selectFrom('itensCompra as i')
    .innerJoin('produtos as p', 'p.id', 'i.produtoId')
    .select([
      'i.produtoId',
      'p.nome',
      'p.unidade',
      'i.quantidade',
      'i.custoUnitario',
    ])
    .where('i.compraId', '=', compra.id)
    .orderBy('i.id')
    .execute();
  const parcelas = await c.db
    .selectFrom('contas')
    .select([
      'id',
      'parcela',
      'parcelas',
      'valor',
      'vencimento',
      'situacao',
      'pagoEm',
    ])
    .where('compraId', '=', compra.id)
    .orderBy('parcela')
    .execute();
  return { ...compra, itens, parcelas };
}

/**
 * Último custo dos produtos da compra = o da compra válida mais recente pela
 * data (compra lançada com data antiga não sobrescreve o custo de uma mais
 * nova). No cancelamento, a própria compra não conta (`semEla`).
 */
async function atualizarUltimoCusto(
  c: Conexao,
  compraId: number,
  { semEla = false } = {},
): Promise<void> {
  await c.db
    .updateTable('produtos as p')
    .set((eb) => {
      let custo = eb
        .selectFrom('itensCompra as i')
        .innerJoin('compras as cp', 'cp.id', 'i.compraId')
        .select('i.custoUnitario')
        .whereRef('i.produtoId', '=', 'p.id')
        .where('cp.canceladaEm', 'is', null);
      if (semEla) custo = custo.where('cp.id', '<>', compraId);
      return {
        ultimoCusto: custo
          .orderBy('cp.data', 'desc')
          .orderBy('cp.id', 'desc')
          .limit(1),
      };
    })
    .where('p.id', 'in', (eb) =>
      eb
        .selectFrom('itensCompra')
        .select('itensCompra.produtoId')
        .where('itensCompra.compraId', '=', compraId),
    )
    .execute();
}

/** Corpo de POST /compras (o schema da rota confere tipo e tamanho). */
export interface DadosDaCompra {
  fornecedorId?: Valor;
  data?: string | null;
  frete?: Valor;
  desconto?: Valor;
  observacao?: string | null;
  itens?:
    | { produtoId?: Valor; quantidade?: Valor; custoUnitario?: Valor }[]
    | null;
  parcelas?: { valor?: Valor; vencimento?: string | null }[] | null;
}

/**
 * Registra a compra já recebida: entrada no estoque (com último custo) e as
 * parcelas a pagar. Tudo ou nada (mesma transação).
 */
export async function registrarCompra(
  c: Conexao,
  barbeariaId: number,
  usuarioId: number,
  dados: DadosDaCompra,
): Promise<Compra> {
  const fornecedorId = Number(dados.fornecedorId);
  if (!Number.isInteger(fornecedorId) || fornecedorId <= 0)
    throw invalido('Escolha o fornecedor da compra.');
  const fornecedor = await c.db
    .selectFrom('fornecedores')
    .select('nome')
    .where('id', '=', fornecedorId)
    .where('excluidoEm', 'is', null)
    .executeTakeFirst();
  if (!fornecedor) throw invalido('Escolha o fornecedor da compra.');
  const data = String(dados.data ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
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

  const compra = await c.db
    .insertInto('compras')
    .values({
      barbeariaId,
      fornecedorId,
      data,
      frete,
      desconto,
      total,
      observacao: String(dados.observacao ?? '').slice(0, 2000),
      criadaPor: usuarioId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
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
    await c.db
      .insertInto('itensCompra')
      .values({
        barbeariaId,
        compraId: compra.id,
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        custoUnitario: i.custoUnitario,
      })
      .execute();
  }
  // Último custo = o da compra válida mais recente pela data, igual ao cancelamento.
  await atualizarUltimoCusto(c, compra.id);
  if (total > 0) {
    await garantirCategoriasPadrao(c, barbeariaId);
    // Existe sempre: garantirCategoriasPadrao acabou de criá-la se faltava.
    const categoria = await c.db
      .selectFrom('categoriasFinanceiras')
      .select('id')
      .where('tipo', '=', 'pagar')
      .where((eb) => eb(eb.fn('lower', ['nome']), '=', 'compra de produtos'))
      .executeTakeFirstOrThrow();
    for (const [n, p] of parcelas.entries())
      await c.db
        .insertInto('contas')
        .values({
          barbeariaId,
          tipo: 'pagar',
          descricao: `Compra #${compra.id} · ${fornecedor.nome}`,
          categoriaId: categoria.id,
          valor: p.valor,
          vencimento: p.vencimento,
          fornecedorId,
          compraId: compra.id,
          parcela: n + 1,
          parcelas: parcelas.length,
          origem: 'compra',
        })
        .execute();
  }
  return obterCompra(c, compra.id);
}

/** Cancela a compra: estorna o estoque e as parcelas, se nenhuma foi paga. */
export async function cancelarCompra(
  c: Conexao,
  barbeariaId: number,
  usuarioId: number,
  id: number | string,
): Promise<Compra> {
  const cp = await c.db
    .selectFrom('compras')
    .select(['id', 'canceladaEm'])
    .where('id', '=', Number(id))
    .forUpdate()
    .executeTakeFirst();
  if (!cp) throw naoEncontrado('Compra não encontrada.');
  if (cp.canceladaEm) throw conflito('Essa compra já foi cancelada.');
  const paga = await c.db
    .selectFrom('contas')
    .select('id')
    .where('compraId', '=', cp.id)
    .where('situacao', '=', 'quitada')
    .executeTakeFirst();
  if (paga)
    throw conflito(
      'Essa compra já tem parcela paga. Estorne o pagamento antes de cancelar.',
    );
  const itens = await c.db
    .selectFrom('itensCompra')
    .select(['produtoId', 'quantidade', 'custoUnitario'])
    .where('compraId', '=', cp.id)
    .orderBy('produtoId')
    .execute();
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
  await atualizarUltimoCusto(c, cp.id, { semEla: true });
  await c.db
    .updateTable('contas')
    .set({ situacao: 'cancelada' })
    .where('compraId', '=', cp.id)
    .where('situacao', '=', 'aberta')
    .execute();
  await c.db
    .updateTable('compras')
    .set({ canceladaEm: sql`now()` })
    .where('id', '=', cp.id)
    .execute();
  return obterCompra(c, cp.id);
}
