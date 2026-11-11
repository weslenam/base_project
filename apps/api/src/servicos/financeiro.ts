import {
  agruparPrevisaoPorSemana,
  datasDeRecorrencia,
  movimentoDaBaixa,
  situacaoDaConta,
  validarBaixa,
  validarConta,
} from '@barbertime/dominio';
import type { ContaParaPrevisao, Valor } from '@barbertime/dominio';
import { sql } from 'kysely';
import { conflito, invalido, naoEncontrado } from '../infra/erros.ts';
import type { Conexao } from '../infra/banco.ts';
import { garantirCategoriasPadrao } from './estoque.ts';
import type {
  CategoriaFinanceira,
  ContaFinanceira,
  PrevisaoFinanceira,
  RecorrenciaFinanceira,
} from '@barbertime/contratos';

// Contas a pagar e a receber e categorias (planejamento 0027, parte 2, fatia
// 2A). Tudo roda no contexto da barbearia (RLS). A baixa com "dinheiro do
// caixa" vira saída ou entrada na gaveta do caixa de hoje; o estorno desfaz,
// só com aquele caixa ainda aberto.

/** Código do erro do Postgres (ex.: 23505, violação de índice único). */
const codigoDoErro = (erro: unknown): unknown =>
  typeof erro === 'object' && erro !== null && 'code' in erro
    ? erro.code
    : undefined;

// ---- categorias ----

const selecionarCategorias = (c: Conexao) =>
  c.db
    .selectFrom('categoriasFinanceiras as cf')
    .select(['cf.id', 'cf.tipo', 'cf.nome', 'cf.ativa'])
    .select((eb) =>
      eb
        .exists(
          eb
            .selectFrom('contas as ct')
            .select('ct.id')
            .whereRef('ct.categoriaId', '=', 'cf.id'),
        )
        // No Postgres o exists volta boolean (o SqlBool do Kysely cobre outros bancos).
        .$castTo<boolean>()
        .as('emUso'),
    );

export async function listarCategorias(
  c: Conexao,
  barbeariaId: number,
): Promise<CategoriaFinanceira[]> {
  // As padrão nascem só na primeira vez: excluída ou renomeada não volta
  // (issue #25).
  const ja = await c.db
    .selectFrom('categoriasFinanceiras')
    .select('id')
    .limit(1)
    .executeTakeFirst();
  if (!ja) await garantirCategoriasPadrao(c, barbeariaId);
  return selecionarCategorias(c)
    .orderBy('cf.tipo')
    .orderBy((eb) => eb.fn('lower', ['cf.nome']))
    .execute();
}

async function buscarCategoria(
  c: Conexao,
  id: number | string,
): Promise<CategoriaFinanceira> {
  const cat = await selecionarCategorias(c)
    .where('cf.id', '=', Number(id))
    .executeTakeFirst();
  if (!cat) throw naoEncontrado('Categoria não encontrada.');
  return cat;
}

/** Corpo de POST/PUT /financeiro/categorias. */
export interface DadosDaCategoria {
  id?: number | null;
  nome?: string | null;
  tipo?: string | null;
  ativa?: boolean | null;
}

export async function salvarCategoria(
  c: Conexao,
  barbeariaId: number,
  dados: DadosDaCategoria = {},
): Promise<CategoriaFinanceira> {
  const nome = String(dados.nome ?? '').trim();
  if (!nome) throw invalido('Informe o nome da categoria.');
  if (nome.length > 80) throw invalido('O nome está muito longo.');
  const id = dados.id ? Number(dados.id) : null;
  const atual = id ? await buscarCategoria(c, id) : null;
  const tipo = atual?.tipo ?? dados.tipo;
  if (tipo !== 'pagar' && tipo !== 'receber')
    throw invalido('Escolha se a categoria é de contas a pagar ou a receber.');
  const ativa = dados.ativa ?? atual?.ativa ?? true;
  try {
    if (id) {
      await c.db
        .updateTable('categoriasFinanceiras')
        .set({ nome, ativa: Boolean(ativa) })
        .where('id', '=', id)
        .execute();
      return buscarCategoria(c, id);
    }
    const nova = await c.db
      .insertInto('categoriasFinanceiras')
      .values({ barbeariaId, tipo, nome })
      .returning('id')
      .executeTakeFirstOrThrow();
    return buscarCategoria(c, nova.id);
  } catch (erro) {
    if (codigoDoErro(erro) === '23505')
      throw conflito(`Já existe uma categoria chamada "${nome}".`);
    throw erro;
  }
}

/** Categoria com conta não se exclui: só se desativa. */
export async function excluirCategoria(
  c: Conexao,
  id: number | string,
): Promise<void> {
  const cat = await buscarCategoria(c, id);
  if (cat.emUso)
    throw conflito(
      `A categoria "${cat.nome}" tem contas: desative em vez de excluir.`,
    );
  await c.db
    .deleteFrom('categoriasFinanceiras')
    .where('id', '=', cat.id)
    .execute();
}

// ---- contas ----

const selecionarContas = (c: Conexao) =>
  c.db
    .selectFrom('contas as ct')
    .innerJoin('categoriasFinanceiras as cf', 'cf.id', 'ct.categoriaId')
    .leftJoin('fornecedores as f', 'f.id', 'ct.fornecedorId')
    .leftJoin('clientes as cl', 'cl.id', 'ct.clienteId')
    .select([
      'ct.id',
      'ct.tipo',
      'ct.descricao',
      'ct.categoriaId',
      'cf.nome as categoriaNome',
      'ct.valor',
      'ct.vencimento',
      'ct.fornecedorId',
      'f.nome as fornecedorNome',
      'ct.clienteId',
      'cl.nome as clienteNome',
      'ct.compraId',
      'ct.recorrenciaId',
      'ct.parcela',
      'ct.parcelas',
      'ct.origem',
      'ct.situacao',
      'ct.pagoEm',
      'ct.valorPago',
      'ct.forma',
    ]);

type LinhaDeConta = Awaited<
  ReturnType<ReturnType<typeof selecionarContas>['execute']>
>[number];

const completar =
  (hoje: string) =>
  (conta: LinhaDeConta): ContaFinanceira => ({
    ...conta,
    situacaoAtual: situacaoDaConta(conta, hoje),
  });

/** Filtros de GET /financeiro/contas. */
export interface FiltrosDeContas {
  tipo?: string | null;
  situacao?: string | null;
  de?: string | null;
  ate?: string | null;
}

/**
 * Contas com filtros: tipo (pagar|receber), situacao (aberta, vencida,
 * quitada, cancelada, todas; vazio = todas menos canceladas) e período de
 * vencimento.
 */
export async function listarContas(
  c: Conexao,
  filtros: FiltrosDeContas,
  hoje: string,
): Promise<ContaFinanceira[]> {
  let consulta = selecionarContas(c);
  if (filtros.tipo) consulta = consulta.where('ct.tipo', '=', filtros.tipo);
  if (filtros.de) consulta = consulta.where('ct.vencimento', '>=', filtros.de);
  if (filtros.ate)
    consulta = consulta.where('ct.vencimento', '<=', filtros.ate);
  switch (filtros.situacao) {
    case 'vencida':
      consulta = consulta
        .where('ct.situacao', '=', 'aberta')
        .where('ct.vencimento', '<', hoje);
      break;
    case 'aberta':
    case 'quitada':
    case 'cancelada':
      consulta = consulta.where('ct.situacao', '=', filtros.situacao);
      break;
    case 'todas':
      break;
    default:
      consulta = consulta.where('ct.situacao', '<>', 'cancelada');
  }
  const linhas = await consulta
    .orderBy('ct.vencimento')
    .orderBy('ct.id')
    .limit(500)
    .execute();
  return linhas.map(completar(hoje));
}

async function buscarConta(
  c: Conexao,
  id: number | string,
  { travar = false } = {},
): Promise<LinhaDeConta> {
  let consulta = selecionarContas(c).where('ct.id', '=', Number(id));
  if (travar) consulta = consulta.forUpdate('ct');
  const conta = await consulta.executeTakeFirst();
  if (!conta) throw naoEncontrado('Conta não encontrada.');
  return conta;
}

export async function obterConta(
  c: Conexao,
  id: number | string,
  hoje: string,
): Promise<ContaFinanceira> {
  return completar(hoje)(await buscarConta(c, id));
}

/** Categoria ativa e do mesmo tipo da conta (a RLS limita à barbearia). */
async function exigirCategoria(
  c: Conexao,
  id: number,
  tipo: string,
): Promise<void> {
  const cat = await c.db
    .selectFrom('categoriasFinanceiras')
    .select(['tipo', 'ativa'])
    .where('id', '=', Number(id))
    .executeTakeFirst();
  if (!cat) throw invalido('Categoria não encontrada.');
  if (cat.tipo !== tipo)
    throw invalido(
      `Essa categoria é de contas a ${cat.tipo === 'pagar' ? 'pagar' : 'receber'}.`,
    );
  if (!cat.ativa) throw invalido('Essa categoria está desativada.');
}

/** Fornecedor ou cliente ativo (a RLS limita à barbearia). */
async function exigirReferencia(
  c: Conexao,
  tabela: 'fornecedores' | 'clientes',
  id: Valor,
  mensagem: string,
): Promise<number | null> {
  if (!id) return null;
  const r = await c.db
    .selectFrom(tabela)
    .select('id')
    .where('id', '=', Number(id))
    .where('excluidoEm', 'is', null)
    .executeTakeFirst();
  if (!r) throw invalido(mensagem);
  return Number(id);
}

/** Corpo de POST/PUT /financeiro/contas. */
export interface DadosDaConta {
  tipo?: string | null;
  descricao?: string | null;
  categoriaId?: number | null;
  valor?: Valor;
  vencimento?: string | null;
  fornecedorId?: number | null;
  clienteId?: number | null;
}

const dadosDaConta = (
  dados: DadosDaConta,
  tipo: string | null | undefined,
) => ({
  tipo: tipo ?? undefined,
  descricao: String(dados.descricao ?? '').trim(),
  categoriaId: dados.categoriaId ? Number(dados.categoriaId) : null,
  valor: Number(dados.valor),
  vencimento: dados.vencimento ?? '',
});

/**
 * Conta validada pelo domínio. O validarConta já recusa tipo e categoria
 * vazios; as conferências abaixo repetem isso para o compilador, com as
 * mesmas mensagens.
 */
function contaValida(dados: DadosDaConta, tipo: string | null | undefined) {
  const conta = dadosDaConta(dados, tipo);
  const motivo = validarConta(conta);
  if (motivo) throw invalido(motivo);
  if (!conta.tipo) throw invalido('Escolha se a conta é a pagar ou a receber.');
  if (!conta.categoriaId) throw invalido('Escolha a categoria.');
  if (conta.descricao.length > 200)
    throw invalido('A descrição está muito longa.');
  return { ...conta, tipo: conta.tipo, categoriaId: conta.categoriaId };
}

/** Lançamento manual: fornecedor só a pagar, cliente só a receber. */
export async function criarConta(
  c: Conexao,
  barbeariaId: number,
  dados: DadosDaConta = {},
  hoje: string,
): Promise<ContaFinanceira> {
  const conta = contaValida(dados, dados.tipo);
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
  const nova = await c.db
    .insertInto('contas')
    .values({
      barbeariaId,
      tipo: conta.tipo,
      descricao: conta.descricao,
      categoriaId: conta.categoriaId,
      valor: conta.valor,
      vencimento: conta.vencimento,
      fornecedorId,
      clienteId,
      origem: 'manual',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return obterConta(c, nova.id, hoje);
}

/**
 * Edita a conta aberta (decisão 5): descrição, categoria, valor, vencimento e
 * fornecedor ou cliente. A parcela de compra só muda o vencimento.
 */
export async function editarConta(
  c: Conexao,
  id: number | string,
  dados: DadosDaConta = {},
  hoje: string,
): Promise<ContaFinanceira> {
  const atual = await buscarConta(c, id, { travar: true });
  if (atual.situacao !== 'aberta')
    throw conflito('Só dá para alterar uma conta em aberto.');
  if (atual.origem === 'compra') {
    const vencimento = dados.vencimento ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento))
      throw invalido('Informe o vencimento.');
    await c.db
      .updateTable('contas')
      .set({ vencimento })
      .where('id', '=', atual.id)
      .execute();
    return obterConta(c, atual.id, hoje);
  }
  const conta = contaValida(dados, atual.tipo);
  if (conta.categoriaId !== atual.categoriaId)
    await exigirCategoria(c, conta.categoriaId, conta.tipo);
  // Fornecedor ou cliente que já estava na conta fica, mesmo excluído depois
  // (issue #27); só um novo precisa estar ativo.
  const referencia = async (
    campo: 'fornecedorId' | 'clienteId',
    tabela: 'fornecedores' | 'clientes',
    mensagem: string,
  ) => {
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
  await c.db
    .updateTable('contas')
    .set({
      descricao: conta.descricao,
      categoriaId: conta.categoriaId,
      valor: conta.valor,
      vencimento: conta.vencimento,
      fornecedorId,
      clienteId,
    })
    .where('id', '=', atual.id)
    .execute();
  return obterConta(c, atual.id, hoje);
}

/** Cancela a conta aberta. A parcela de compra sai junto com a compra. */
export async function cancelarConta(
  c: Conexao,
  id: number | string,
  hoje: string,
): Promise<ContaFinanceira> {
  const conta = await buscarConta(c, id, { travar: true });
  if (conta.situacao !== 'aberta')
    throw conflito('Só dá para cancelar uma conta em aberto.');
  if (conta.origem === 'compra')
    throw conflito(
      'Esta é uma parcela de compra: para desistir, cancele a compra.',
    );
  await c.db
    .updateTable('contas')
    .set({ situacao: 'cancelada' })
    .where('id', '=', conta.id)
    .execute();
  return obterConta(c, conta.id, hoje);
}

/** Corpo de POST /financeiro/contas/:id/baixar. */
export interface DadosDaBaixa {
  data?: string | null;
  valorPago?: Valor;
  forma?: string | null;
}

/**
 * Baixa (pagar ou receber). Com "dinheiro do caixa", a data é hoje e o valor
 * vira saída ou entrada no caixa de hoje, que precisa estar aberto.
 */
export async function baixarConta(
  c: Conexao,
  barbeariaId: number,
  id: number | string,
  dados: DadosDaBaixa = {},
  { hoje, usuarioId }: { hoje: string; usuarioId?: number | null },
): Promise<ContaFinanceira> {
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
  // validarBaixa já recusa forma fora da lista; repetido para o compilador.
  const forma = baixa.forma;
  if (!forma) throw invalido('Escolha a forma de pagamento.');
  if (baixa.data > hoje)
    throw invalido('A data do pagamento não pode ser depois de hoje.');
  const movimento = movimentoDaBaixa(conta, baixa);
  if (movimento) {
    if (baixa.data !== hoje)
      throw invalido(
        'Com dinheiro do caixa, a data é hoje: o valor sai da gaveta de hoje.',
      );
    // Trava o caixa contra o fechamento ao mesmo tempo (issue #28).
    const caixa = await c.db
      .selectFrom('caixas')
      .select(['id', 'aberto'])
      .where('data', '=', hoje)
      .forUpdate()
      .executeTakeFirst();
    if (!caixa?.aberto)
      throw conflito(
        'Abra o caixa de hoje ou escolha outra forma de pagamento.',
      );
    await c.db
      .insertInto('movimentosCaixa')
      .values({
        barbeariaId,
        caixaId: caixa.id,
        tipo: movimento.tipo,
        valor: movimento.valor,
        descricao: movimento.descricao.slice(0, 200),
        contaId: conta.id,
        criadoPor: usuarioId ?? null,
      })
      .execute();
  }
  await c.db
    .updateTable('contas')
    .set({
      situacao: 'quitada',
      pagoEm: baixa.data,
      valorPago: baixa.valorPago,
      forma,
    })
    .where('id', '=', conta.id)
    .execute();
  return obterConta(c, conta.id, hoje);
}

/**
 * Estorno da baixa: a conta volta a ficar aberta. Se saiu ou entrou dinheiro
 * da gaveta, aquele caixa precisa estar aberto (decisão 3); as outras formas
 * estornam a qualquer momento.
 */
export async function estornarBaixa(
  c: Conexao,
  id: number | string,
  hoje: string,
): Promise<ContaFinanceira> {
  const conta = await buscarConta(c, id, { travar: true });
  if (conta.situacao !== 'quitada')
    throw conflito('Só dá para estornar uma conta paga.');
  const mov = await c.db
    .selectFrom('movimentosCaixa as m')
    .innerJoin('caixas as cx', 'cx.id', 'm.caixaId')
    .select(['m.id', 'cx.aberto'])
    .where('m.contaId', '=', conta.id)
    .where('m.estornadoEm', 'is', null)
    .forUpdate('m')
    .executeTakeFirst();
  if (mov) {
    if (!mov.aberto)
      throw conflito(
        'O caixa em que esse dinheiro saiu já foi fechado: não dá para estornar.',
      );
    await c.db
      .updateTable('movimentosCaixa')
      .set({ estornadoEm: sql<Date>`now()` })
      .where('id', '=', mov.id)
      .execute();
  }
  await c.db
    .updateTable('contas')
    .set({ situacao: 'aberta', pagoEm: null, valorPago: null, forma: null })
    .where('id', '=', conta.id)
    .execute();
  return obterConta(c, conta.id, hoje);
}

// ---- recorrências ----

const selecionarRecorrencias = (c: Conexao) =>
  c.db
    .selectFrom('recorrencias as r')
    .innerJoin('categoriasFinanceiras as cf', 'cf.id', 'r.categoriaId')
    .leftJoin('fornecedores as f', 'f.id', 'r.fornecedorId')
    .select([
      'r.id',
      'r.tipo',
      'r.descricao',
      'r.categoriaId',
      'cf.nome as categoriaNome',
      'r.valor',
      'r.diaDoMes',
      'r.fornecedorId',
      'f.nome as fornecedorNome',
      'r.encerradaEm',
    ]);

type LinhaDeRecorrencia = Awaited<
  ReturnType<ReturnType<typeof selecionarRecorrencias>['execute']>
>[number];

const toRecorrencia = (r: LinhaDeRecorrencia): RecorrenciaFinanceira => ({
  id: r.id,
  tipo: r.tipo,
  descricao: r.descricao,
  categoriaId: r.categoriaId,
  categoriaNome: r.categoriaNome,
  valor: Number(r.valor),
  diaDoMes: r.diaDoMes,
  fornecedorId: r.fornecedorId,
  fornecedorNome: r.fornecedorNome ?? null,
  encerradaEm: r.encerradaEm,
});

/**
 * Gera as contas dos próximos 3 meses para uma recorrência, se ainda não
 * existirem. Idempotente: pode ser chamada várias vezes sem duplicar.
 */
async function gerarContasDaRecorrencia(
  c: Conexao,
  barbeariaId: number,
  r: LinhaDeRecorrencia,
  hoje: string,
): Promise<void> {
  if (r.encerradaEm) return;
  const datas = datasDeRecorrencia(r.diaDoMes, hoje);
  for (const vencimento of datas) {
    const ja = await c.db
      .selectFrom('contas')
      .select('id')
      .where('recorrenciaId', '=', r.id)
      .where('vencimento', '=', vencimento)
      .executeTakeFirst();
    if (ja) continue;
    await c.db
      .insertInto('contas')
      .values({
        barbeariaId,
        tipo: r.tipo,
        descricao: r.descricao,
        categoriaId: r.categoriaId,
        valor: Number(r.valor),
        vencimento,
        fornecedorId: r.tipo === 'pagar' ? r.fornecedorId : null,
        recorrenciaId: r.id,
        origem: 'recorrencia',
      })
      .onConflict((oc) =>
        oc.constraint('contas_recorrencia_vencimento_unique').doNothing(),
      )
      .execute();
  }
}

/** Lista recorrências e garante as contas dos próximos 3 meses. */
export async function listarRecorrencias(
  c: Conexao,
  barbeariaId: number,
  hoje: string,
): Promise<RecorrenciaFinanceira[]> {
  const linhas = await selecionarRecorrencias(c)
    .where('r.barbeariaId', '=', barbeariaId)
    .orderBy((eb) => eb.fn('lower', ['r.descricao']))
    .execute();
  for (const r of linhas) {
    await gerarContasDaRecorrencia(c, barbeariaId, r, hoje);
  }
  return linhas.map(toRecorrencia);
}

async function buscarRecorrencia(
  c: Conexao,
  barbeariaId: number,
  id: number | string,
): Promise<LinhaDeRecorrencia> {
  const r = await selecionarRecorrencias(c)
    .where('r.barbeariaId', '=', barbeariaId)
    .where('r.id', '=', Number(id))
    .executeTakeFirst();
  if (!r) throw naoEncontrado('Recorrência não encontrada.');
  return r;
}

/** Corpo de POST/PUT /financeiro/recorrencias. */
export interface DadosDaRecorrencia {
  tipo?: string | null;
  descricao?: string | null;
  categoriaId?: number | null;
  valor?: Valor;
  diaDoMes?: number | null;
  fornecedorId?: number | null;
}

/** Valida e normaliza. Retorna mensagem de erro ou null. */
function validarRecorrencia(d: DadosDaRecorrencia, tipo?: string | null): string | null {
  if (!['pagar', 'receber'].includes(String(tipo ?? '')))
    return 'Escolha se a recorrência é a pagar ou a receber.';
  const desc = String(d.descricao ?? '').trim();
  if (!desc) return 'Informe a descrição.';
  if (desc.length > 200) return 'A descrição está muito longa.';
  if (!d.categoriaId) return 'Escolha a categoria.';
  const valor = Number(d.valor);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 999_999_999.99)
    return 'Informe o valor.';
  const dia = Number(d.diaDoMes);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28)
    return 'O dia do mês deve ser entre 1 e 28.';
  return null;
}

export async function salvarRecorrencia(
  c: Conexao,
  barbeariaId: number,
  dados: DadosDaRecorrencia & { id?: number | null },
  hoje: string,
): Promise<RecorrenciaFinanceira> {
  const id = dados.id ? Number(dados.id) : null;
  const atual = id ? await buscarRecorrencia(c, barbeariaId, id) : null;
  const tipo = atual?.tipo ?? dados.tipo;
  const motivo = validarRecorrencia(dados, tipo);
  if (motivo) throw invalido(motivo);
  if (!tipo) throw invalido('Escolha se a recorrência é a pagar ou a receber.');
  const descricao = String(dados.descricao ?? '').trim();
  const categoriaId = Number(dados.categoriaId);
  const valor = Number(dados.valor);
  const diaDoMes = Number(dados.diaDoMes);
  await exigirCategoria(c, categoriaId, tipo);
  const fornecedorId =
    tipo === 'pagar'
      ? await exigirReferencia(
          c,
          'fornecedores',
          dados.fornecedorId,
          'Fornecedor não encontrado.',
        )
      : null;
  let rId: number;
  if (atual) {
    await c.db
      .updateTable('recorrencias')
      .set({ descricao, categoriaId, valor, diaDoMes, fornecedorId })
      .where('id', '=', atual.id)
      .execute();
    rId = atual.id;
  } else {
    const nova = await c.db
      .insertInto('recorrencias')
      .values({ barbeariaId, tipo, descricao, categoriaId, valor, diaDoMes, fornecedorId })
      .returning('id')
      .executeTakeFirstOrThrow();
    rId = nova.id;
  }
  const linha = await buscarRecorrencia(c, barbeariaId, rId);
  await gerarContasDaRecorrencia(c, barbeariaId, linha, hoje);
  return toRecorrencia(linha);
}

/** Encerra a recorrência e cancela as contas futuras em aberto. */
export async function encerrarRecorrencia(
  c: Conexao,
  barbeariaId: number,
  id: number | string,
  hoje: string,
): Promise<RecorrenciaFinanceira> {
  const r = await buscarRecorrencia(c, barbeariaId, id);
  if (r.encerradaEm) throw conflito('Esta recorrência já foi encerrada.');
  await c.db
    .updateTable('recorrencias')
    .set({ encerradaEm: hoje })
    .where('id', '=', r.id)
    .execute();
  await c.db
    .updateTable('contas')
    .set({ situacao: 'cancelada' })
    .where('recorrenciaId', '=', r.id)
    .where('situacao', '=', 'aberta')
    .where('vencimento', '>', hoje)
    .execute();
  return toRecorrencia(await buscarRecorrencia(c, barbeariaId, r.id));
}

// ---- previsão ----

/** Previsão de fluxo de caixa: contas abertas agrupadas por semana. */
export async function previsao(
  c: Conexao,
  barbeariaId: number,
  dias: number,
  hoje: string,
): Promise<PrevisaoFinanceira> {
  const diasValidos = [30, 60, 90].includes(dias) ? dias : 30;
  const linhas = await c.db
    .selectFrom('contas as ct')
    .innerJoin('categoriasFinanceiras as cf', 'cf.id', 'ct.categoriaId')
    .select(['ct.tipo', 'ct.valor', 'ct.vencimento', 'ct.situacao', 'cf.nome as categoriaNome'])
    .where('ct.barbeariaId', '=', barbeariaId)
    .where('ct.situacao', '=', 'aberta')
    .execute();
  const contas: ContaParaPrevisao[] = linhas.map((l) => ({
    tipo: l.tipo,
    valor: Number(l.valor),
    vencimento: l.vencimento,
    situacao: l.situacao,
    categoriaNome: l.categoriaNome,
  }));
  return agruparPrevisaoPorSemana(contas, hoje, diasValidos);
}
