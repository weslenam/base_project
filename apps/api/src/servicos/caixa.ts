import {
  diferencaDeCaixa,
  motivoParaNaoReceber,
  resumoDoCaixa,
  totalDaComanda,
} from '@barbertime/dominio';
import type { ItemComanda, Valor } from '@barbertime/dominio';
import { sql } from 'kysely';
import { conflito, invalido, naoEncontrado } from '../infra/erros.ts';
import type { Conexao } from '../infra/banco.ts';
import { agora } from './agenda.ts';
import { baixarComanda } from './estoque.ts';
import { conferirResgate, fidelidadeAoReceber } from './fidelidade.ts';
import type { FidelidadeNoPedido } from './fidelidade.ts';
import {
  buscarPacote,
  conferirUsos,
  conferirVendaPendente,
  pacotesAoCancelar,
  pacotesAoReceber,
} from './pacotes.ts';
import type {
  Caixa,
  CaixaComResumo,
  ComandaDoCaixa,
  ComandaRecebida,
} from '@barbertime/contratos';

// Caixa do dia e comandas (planejamento 0020, fase 1). A comanda nasce no
// check-in ou na entrada na fila e acompanha o atendimento até o pagamento.
// Fidelidade (crédito e resgate) e pacotes (venda, uso e renovação) no
// planejamento 0034.

const selecionarCaixa = (c: Conexao) =>
  c.db
    .selectFrom('caixas')
    .select([
      'id',
      'data',
      'valorInicial',
      'aberto',
      'abertoAs',
      'fechadoAs',
      'dinheiroContado',
      'diferenca',
    ]);

/** Comandas com caixa, cliente e barbeiro (complete com where e order). */
export const selecionarComandas = (c: Conexao) =>
  c.db
    .selectFrom('comandas as cm')
    .innerJoin('caixas as cx', 'cx.id', 'cm.caixaId')
    .leftJoin('clientes as cl', 'cl.id', 'cm.clienteId')
    .leftJoin('barbeiros as b', 'b.id', 'cm.barbeiroId')
    .leftJoin('atendimentos as a', 'a.id', 'cm.atendimentoId')
    .select([
      'cm.id',
      'cm.caixaId',
      'cx.data',
      'cm.atendimentoId',
      'cm.clienteId',
      'cm.barbeiroId',
      'cm.hora',
      'cm.itens',
      'cm.desconto',
      'cm.forma',
      'cm.estado',
      'cm.pagaAs',
      'cm.premioFidelidade',
      'cm.cashbackUsado',
    ])
    .select((eb) => [
      eb.fn
        .coalesce('cl.nome', 'a.clienteNome', eb.val('Cliente avulso'))
        .as('clienteNome'),
      eb.fn.coalesce('b.nome', eb.val('')).as('barbeiroNome'),
    ]);

type LinhaDeComanda = Awaited<
  ReturnType<ReturnType<typeof selecionarComandas>['execute']>
>[number];

/** Comanda com os totais (serviços, produtos, subtotal, desconto, total). */
export const completarComanda = (linha: LinhaDeComanda): ComandaDoCaixa => {
  // A coluna jsonb `itens` só é gravada por salvarComanda: sempre uma lista
  // de itens normalizados.
  const cm = { ...linha, itens: linha.itens as ItemComanda[] };
  return { ...cm, ...totalDaComanda(cm) };
};

export async function caixaDoDia(
  c: Conexao,
  data: string = agora().data,
): Promise<Caixa | null> {
  const caixa = await selecionarCaixa(c)
    .where('data', '=', data)
    .executeTakeFirst();
  return caixa ?? null;
}

export async function exigirCaixaAberto(c: Conexao): Promise<Caixa> {
  const caixa = await caixaDoDia(c);
  if (!caixa?.aberto)
    throw conflito('Abra o caixa de hoje antes de lançar comandas.');
  return caixa;
}

export async function comandasDoCaixa(
  c: Conexao,
  caixaId: number,
): Promise<ComandaDoCaixa[]> {
  const linhas = await selecionarComandas(c)
    .where('cm.caixaId', '=', caixaId)
    .orderBy('cm.hora', 'desc')
    .orderBy('cm.id', 'desc')
    .execute();
  return linhas.map(completarComanda);
}

export async function obterComanda(
  c: Conexao,
  id: number | string,
  { travar = false } = {},
): Promise<ComandaDoCaixa> {
  let consulta = selecionarComandas(c).where('cm.id', '=', Number(id));
  if (travar) consulta = consulta.forUpdate('cm');
  const cm = await consulta.executeTakeFirst();
  if (!cm) throw naoEncontrado('Comanda não encontrada.');
  return completarComanda(cm);
}

/**
 * Trava a comanda para mudar o estado. Sempre na mesma ordem (atendimento,
 * depois comanda), como as rotas do balcão, para não haver impasse.
 */
async function travarComanda(
  c: Conexao,
  id: number | string,
): Promise<ComandaDoCaixa> {
  const cm = await obterComanda(c, id);
  if (cm.atendimentoId)
    await c.db
      .selectFrom('atendimentos')
      .select('id')
      .where('id', '=', cm.atendimentoId)
      .forUpdate()
      .execute();
  return obterComanda(c, cm.id, { travar: true });
}

/**
 * Comanda que ficou aberta num caixa de outro dia passa para o caixa de hoje:
 * o dinheiro entra no fechamento de hoje e o caixa antigo pode ser fechado.
 */
async function trazerParaOCaixaDeHoje(
  c: Conexao,
  cm: ComandaDoCaixa,
  caixa: Caixa,
): Promise<ComandaDoCaixa> {
  if (cm.caixaId === caixa.id) return cm;
  await c.db
    .updateTable('comandas')
    .set({ caixaId: caixa.id })
    .where('id', '=', cm.id)
    .execute();
  return { ...cm, caixaId: caixa.id };
}

/** O caixa com o resumo do dia. */
async function resumirCaixa(c: Conexao, caixa: Caixa): Promise<CaixaComResumo> {
  const comandas = await comandasDoCaixa(c, caixa.id);
  // Saídas e entradas da gaveta vindas do financeiro (planejamento 0027,
  // parte 2). Só os totais vão para o resumo: a descrição das contas fica com
  // quem tem financeiro.gerenciar.
  const movimentos = await c.db
    .selectFrom('movimentosCaixa')
    .select(['tipo', 'valor'])
    .where('caixaId', '=', caixa.id)
    .where('estornadoEm', 'is', null)
    .execute();
  return {
    ...caixa,
    resumo: resumoDoCaixa({
      valorInicial: caixa.valorInicial,
      comandas,
      movimentos,
    }),
  };
}

export async function caixaComResumo(
  c: Conexao,
  caixa: Caixa | null,
): Promise<CaixaComResumo | null> {
  if (!caixa) return null;
  return resumirCaixa(c, caixa);
}

export async function abrirCaixa(
  c: Conexao,
  barbeariaId: number,
  { valorInicial }: { valorInicial?: Valor },
): Promise<CaixaComResumo | null> {
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
  await c.db
    .insertInto('caixas')
    .values({
      barbeariaId,
      data,
      valorInicial: Number(valorInicial),
      abertoAs: hora,
    })
    .execute();
  return caixaComResumo(c, await caixaDoDia(c));
}

export async function fecharCaixa(
  c: Conexao,
  { dinheiroContado }: { dinheiroContado?: Valor },
): Promise<CaixaComResumo | null> {
  const caixa = await exigirCaixaAberto(c);
  // Trava o caixa: uma baixa em dinheiro do financeiro ao mesmo tempo espera
  // e depois vê o caixa fechado (issue #28).
  await c.db
    .selectFrom('caixas')
    .select('id')
    .where('id', '=', caixa.id)
    .forUpdate()
    .execute();
  const { resumo } = await resumirCaixa(c, caixa);
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
  await c.db
    .updateTable('caixas')
    .set({
      aberto: false,
      fechadoAs: agora().hora,
      dinheiroContado: Number(dinheiroContado),
      diferenca: diferencaDeCaixa(dinheiroContado, resumo.dinheiroEsperado),
    })
    .where('id', '=', caixa.id)
    .execute();
  return caixaComResumo(c, await caixaDoDia(c));
}

/** Barbeiro ativo desta barbearia (a RLS limita a busca à barbearia). */
async function exigirBarbeiro(c: Conexao, id: number): Promise<void> {
  const b = await c.db
    .selectFrom('barbeiros')
    .select('id')
    .where('id', '=', id)
    .where('excluidoEm', 'is', null)
    .executeTakeFirst();
  if (!b) throw invalido('Barbeiro não encontrado.');
}

/** Item como chega no corpo da comanda (nome e preço não são aceitos). */
export interface ItemPedido {
  tipo?: string | null;
  refId?: number | null;
  assinaturaId?: number | null;
  barbeiroId?: number | null;
  quantidade?: Valor;
  /** Item do prêmio da fidelidade (montado pelo servidor; ignorado aqui). */
  premio?: boolean | null;
}

/** Pacotes no pedido: módulo ativo e se é a venda (rotas de assinaturas). */
export interface PacotesNoPedido {
  ativo: boolean;
  venda?: boolean;
}

/**
 * Itens com nome e preço do catálogo no momento da venda (base da comissão
 * futura). Nome e preço nunca vêm de quem chama a API.
 */
async function normalizarItens(
  c: Conexao,
  itens: ItemPedido[] | null = [],
  barbeiroId: number | null,
  pacotes: PacotesNoPedido & { anteriores: ItemComanda[] },
): Promise<ItemComanda[]> {
  // O schema aceita `itens: null`, e antes da conversão isso já parava aqui
  // com erro 500 (o for...of sobre null). Mantido na conversão: issue #41.
  if (itens === null) throw new TypeError('itens is not iterable');
  const normalizados: ItemComanda[] = [];
  const conferidos = new Set(barbeiroId ? [barbeiroId] : []);
  for (const i of itens) {
    // O item do prêmio da fidelidade é montado pelo servidor (conferirResgate).
    if (i.premio) continue;
    const doItem = i.barbeiroId ? Number(i.barbeiroId) : null;
    if (doItem && !conferidos.has(doItem)) {
      await exigirBarbeiro(c, doItem);
      conferidos.add(doItem);
    }
    if ((i.tipo === 'pacote' || i.assinaturaId) && !pacotes.ativo)
      throw invalido('O módulo de pacotes não está ativo nesta barbearia.');
    // Pacote só entra pela venda ou pela renovação (rotas de assinaturas), com
    // o preço do catálogo; salvo de novo, fica como foi vendido (issue #22).
    if (i.tipo === 'pacote') {
      const ja = pacotes.anteriores.findIndex(
        (x) => x.refId === Number(i.refId),
      );
      if (ja >= 0) {
        const [anterior] = pacotes.anteriores.splice(ja, 1);
        normalizados.push({
          ...anterior,
          barbeiroId: doItem ?? anterior?.barbeiroId ?? barbeiroId ?? null,
        });
        continue;
      }
      if (!pacotes.venda)
        throw invalido(
          'Pacote entra na comanda só pela venda, no cadastro do cliente.',
        );
      const pacote = await buscarPacote(c, i.refId);
      normalizados.push({
        tipo: 'pacote',
        refId: pacote.id,
        nome: `Pacote: ${pacote.nome}`,
        preco: Number(pacote.preco),
        quantidade: 1,
        barbeiroId: doItem ?? barbeiroId ?? null,
      });
      continue;
    }
    const produto = i.tipo === 'produto';
    const ref = produto
      ? await c.db
          .selectFrom('produtos')
          .select(['id', 'nome', 'preco'])
          .where('id', '=', Number(i.refId))
          .where('excluidoEm', 'is', null)
          .where('tipo', '=', 'revenda')
          .executeTakeFirst()
      : await c.db
          .selectFrom('servicos')
          .select(['id', 'nome', 'preco'])
          .where('id', '=', Number(i.refId))
          .where('excluidoEm', 'is', null)
          .executeTakeFirst();
    if (!ref)
      throw invalido(`${produto ? 'Produto' : 'Serviço'} não encontrado.`);
    // Serviço usado por pacote: sai por R$ 0, ligado à assinatura; o uso é
    // conferido em conferirUsos (salvar) e gravado ao receber.
    if (!produto && i.assinaturaId) {
      normalizados.push({
        tipo: 'servico',
        refId: ref.id,
        nome: `${ref.nome} (pacote)`,
        preco: 0,
        quantidade: 1,
        barbeiroId: doItem ?? barbeiroId ?? null,
        assinaturaId: Number(i.assinaturaId),
      });
      continue;
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

/** Corpo de POST/PUT /comandas (o schema da rota confere tipo e tamanho). */
export interface DadosDaComanda {
  id?: number | null;
  atendimentoId?: number | null;
  barbeiroId?: number | null;
  clienteId?: number | null;
  itens?: ItemPedido[] | null;
  desconto?: Valor;
  forma?: string | null;
  premioFidelidade?: boolean | null;
  cashbackUsado?: Valor;
}

/**
 * Cria ou atualiza uma comanda aberta. `fidelidade` ({ ativo, hoje }) libera o
 * resgate (prêmio e cashback) quando o módulo está ativo.
 */
export async function salvarComanda(
  c: Conexao,
  barbeariaId: number,
  dados: DadosDaComanda,
  {
    fidelidade = { ativo: false },
    pacotes = { ativo: false },
  }: {
    fidelidade?: Pick<FidelidadeNoPedido, 'ativo'>;
    pacotes?: PacotesNoPedido;
  } = {},
): Promise<ComandaDoCaixa> {
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
    const a = await c.db
      .selectFrom('atendimentos')
      .select('estado')
      .where('id', '=', atendimentoId)
      .executeTakeFirst();
    if (!a) throw invalido('Atendimento não encontrado.');
    if (['desistiu', 'no_show', 'cancelado', 'pago'].includes(a.estado))
      throw invalido('Esse atendimento já foi encerrado.');
  }
  // Itens de pacote já na comanda (venda ou renovação): os únicos aceitos de volta.
  const anteriores = dados.id
    ? (await obterComanda(c, dados.id)).itens.filter((i) => i.tipo === 'pacote')
    : [];
  const itens = await normalizarItens(c, dados.itens, barbeiroId, {
    ...pacotes,
    anteriores,
  });
  const desconto = Number(dados.desconto || 0);
  if (!Number.isFinite(desconto))
    throw invalido('Informe o desconto em reais.');
  if (desconto < 0 || desconto > totalDaComanda({ itens }).subtotal)
    throw invalido('O desconto não pode ser maior que o valor da comanda.');
  const clienteId = dados.clienteId ? Number(dados.clienteId) : null;
  if (clienteId) {
    const r = await c.db
      .selectFrom('clientes')
      .select('id')
      .where('id', '=', clienteId)
      .where('excluidoEm', 'is', null)
      .executeTakeFirst();
    if (!r) throw invalido('Cliente não encontrado.');
  }
  await conferirUsos(c, itens, clienteId, agora().data);
  if (dados.id) await conferirVendaPendente(c, dados.id, itens, clienteId);
  // Módulo desligado: o resgate pedido antes cai ao salvar, para a comanda
  // aberta não ficar travada (planejamento 0037).
  const premioFidelidade = fidelidade.ativo && Boolean(dados.premioFidelidade);
  const cashbackUsado = fidelidade.ativo ? Number(dados.cashbackUsado || 0) : 0;
  if (!Number.isFinite(cashbackUsado) || cashbackUsado < 0)
    throw invalido('Informe o cashback em reais.');
  const { itemPremio } = await conferirResgate(
    c,
    { clienteId, premioFidelidade, cashbackUsado, itens, desconto },
    { ...fidelidade, hoje: agora().data },
  );
  if (itemPremio) itens.push(itemPremio);

  if (dados.id) {
    const atual = await travarComanda(c, dados.id);
    if (atual.estado !== 'aberta')
      throw conflito('Só dá para alterar comanda em aberto.');
    await trazerParaOCaixaDeHoje(c, atual, caixa);
    await c.db
      .updateTable('comandas')
      .set({
        clienteId,
        // Sem barbeiro no pedido, fica o que já estava (coalesce).
        ...(barbeiroId ? { barbeiroId } : {}),
        // jsonb: vai como texto JSON (o pg mandaria a lista como array do Postgres).
        itens: JSON.stringify(itens),
        desconto,
        forma: dados.forma ?? null,
        premioFidelidade,
        cashbackUsado,
      })
      .where('id', '=', atual.id)
      .execute();
    return obterComanda(c, atual.id);
  }
  const nova = await c.db
    .insertInto('comandas')
    .values({
      barbeariaId,
      caixaId: caixa.id,
      atendimentoId,
      clienteId,
      barbeiroId,
      hora: agora().hora,
      // jsonb: vai como texto JSON (o pg mandaria a lista como array do Postgres).
      itens: JSON.stringify(itens),
      desconto,
      forma: dados.forma ?? null,
      premioFidelidade,
      cashbackUsado,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return obterComanda(c, nova.id);
}

/**
 * Recebe a comanda; o atendimento ligado vira "pago". Com o módulo estoque
 * ativo, baixa a revenda e os consumíveis das fichas (planejamento 0027).
 */
export async function receberComanda(
  c: Conexao,
  id: number | string,
  { forma }: { forma?: string | null } = {},
  {
    barbeariaId,
    usuarioId,
    fidelidade = { ativo: false },
  }: {
    barbeariaId?: number;
    usuarioId?: number;
    fidelidade?: Pick<FidelidadeNoPedido, 'ativo'>;
  } = {},
): Promise<ComandaRecebida> {
  const caixa = await exigirCaixaAberto(c);
  const cm = await travarComanda(c, id);
  if (cm.estado !== 'aberta') throw conflito('Essa comanda já foi encerrada.');
  await trazerParaOCaixaDeHoje(c, cm, caixa);
  const motivo = motivoParaNaoReceber({ ...cm, forma: forma ?? cm.forma });
  if (motivo) throw invalido(motivo);
  await c.db
    .updateTable('comandas')
    .set({ estado: 'paga', forma: forma ?? cm.forma, pagaAs: agora().hora })
    .where('id', '=', cm.id)
    .execute();
  if (cm.atendimentoId) {
    await c.db
      .updateTable('atendimentos')
      .set((eb) => ({
        estado: 'pago',
        finalizadoEm: eb.fn.coalesce('finalizadoEm', sql<Date>`now()`),
        iniciadoEm: eb.fn.coalesce('iniciadoEm', sql<Date>`now()`),
      }))
      .where('id', '=', cm.atendimentoId)
      .where('estado', 'in', [
        'agendado',
        'chegou',
        'na_fila',
        'em_atendimento',
        'finalizado',
      ])
      .execute();
  }
  if (barbeariaId) await baixarComanda(c, barbeariaId, cm, usuarioId);
  // Pacotes (planejamento 0034, etapa B): usos e ativação da venda.
  if (barbeariaId) await pacotesAoReceber(c, barbeariaId, cm, agora().data);
  // Fidelidade (planejamento 0034): gastos do resgate e créditos, na mesma transação.
  const creditos = barbeariaId
    ? await fidelidadeAoReceber(c, barbeariaId, cm, {
        ...fidelidade,
        hoje: agora().data,
      })
    : [];
  return { ...(await obterComanda(c, cm.id)), creditos };
}

export async function cancelarComanda(
  c: Conexao,
  id: number | string,
): Promise<ComandaDoCaixa> {
  const cm = await travarComanda(c, id);
  if (cm.estado === 'paga')
    throw conflito('Comanda já recebida não pode ser cancelada.');
  await c.db
    .updateTable('comandas')
    .set({ estado: 'cancelada' })
    .where('id', '=', cm.id)
    .execute();
  await pacotesAoCancelar(c, cm.id);
  return obterComanda(c, cm.id);
}

/**
 * Comanda do atendimento: devolve a existente (não cancelada) ou abre uma nova
 * com cliente, barbeiro e o serviço do atendimento.
 */
export async function comandaDoAtendimento(
  c: Conexao,
  barbeariaId: number,
  atendimento: {
    id: number;
    clienteId: number | null;
    barbeiroId: number | null;
    servicoId: number | null;
  },
): Promise<ComandaDoCaixa> {
  const existente = await c.db
    .selectFrom('comandas')
    .select('id')
    .where('atendimentoId', '=', atendimento.id)
    .where('estado', '<>', 'cancelada')
    .executeTakeFirst();
  if (existente) return obterComanda(c, existente.id);
  // Comanda cancelada antes: libera o vínculo para abrir outra.
  await c.db
    .updateTable('comandas')
    .set({ atendimentoId: null })
    .where('atendimentoId', '=', atendimento.id)
    .execute();
  return salvarComanda(c, barbeariaId, {
    atendimentoId: atendimento.id,
    clienteId: atendimento.clienteId,
    barbeiroId: atendimento.barbeiroId,
    itens: atendimento.servicoId
      ? [{ tipo: 'servico', refId: atendimento.servicoId }]
      : [],
  });
}
