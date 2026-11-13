// Regras de caixa e comanda (MVP, item 5). Cálculos em centavos inteiros para não
// acumular erro de arredondamento; entrada e saída em reais (número).

export const FORMAS_DE_PAGAMENTO = Object.freeze([
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'credito', rotulo: 'Crédito' },
]);

const emCentavos = (reais: number | string | null | undefined): number =>
  Math.round(Number(reais || 0) * 100);
const emReais = (centavos: number): number => centavos / 100;

/** Valor em reais que pode chegar como número ou texto (formulário, banco). */
export type Valor = number | string | null | undefined;

/** Item de comanda (planejamentos 0008, 0015 e 0034). */
export interface ItemComanda {
  /** Sem tipo, conta como serviço. */
  tipo?: 'servico' | 'produto' | 'pacote' | string;
  refId?: number;
  nome?: string;
  preco?: Valor;
  quantidade?: number;
  barbeiroId?: number | null;
  /** Serviço usado por pacote (R$ 0). */
  assinaturaId?: number;
  /** Item do prêmio da fidelidade. */
  premio?: boolean;
}

/** Comanda (o que as regras de caixa usam dela). */
export interface Comanda {
  id?: number;
  estado?: 'aberta' | 'paga' | 'cancelada' | string;
  forma?: string | null;
  itens?: ItemComanda[];
  desconto?: Valor;
  cashbackUsado?: Valor;
  clienteId?: number | null;
  barbeiroId?: number | null;
  data?: string;
  hora?: string;
}

/** Saída ou entrada da gaveta vinda do financeiro (planejamento 0027). */
export interface MovimentoDeCaixa {
  tipo: 'saida' | 'entrada' | string;
  valor: Valor;
}

/**
 * Totais de uma comanda { itens: [{ tipo, preco, quantidade }], desconto }:
 * servicos, produtos, subtotal (= servicos + produtos), desconto e total.
 */
export function totalDaComanda({
  itens = [],
  desconto = 0,
  cashbackUsado = 0,
}: Comanda) {
  let servicos = 0;
  let produtos = 0;
  for (const i of itens) {
    const valor = emCentavos(i.preco) * (i.quantidade ?? 1);
    if (i.tipo === 'produto') produtos += valor;
    else servicos += valor;
  }
  const subtotal = servicos + produtos;
  const descontoC = emCentavos(desconto);
  // Cashback usado (planejamento 0034) abate do que o cliente paga; o caixa só
  // conta o que entrou de fato.
  const cashbackC = emCentavos(cashbackUsado);
  return {
    servicos: emReais(servicos),
    produtos: emReais(produtos),
    subtotal: emReais(subtotal),
    desconto: emReais(descontoC),
    cashback: emReais(cashbackC),
    total: emReais(Math.max(0, subtotal - descontoC - cashbackC)),
  };
}

/**
 * Calcula o valor de comissão do barbeiro sobre uma comanda paga.
 * Base = valor líquido (subtotal − desconto − cashback).
 * O valor é arredondado para 2 casas decimais.
 */
export function calcularComissao({
  total,
  taxa,
}: {
  total: number;
  taxa: number;
}): { baseCalculo: number; taxa: number; valor: number } {
  const base = Math.max(0, total);
  const valor = Math.round((base * taxa) / 100 * 100) / 100;
  return { baseCalculo: base, taxa, valor };
}

/** Motivo pelo qual a comanda não pode ser recebida, ou null se pode. */
export function motivoParaNaoReceber({
  itens = [],
  desconto = 0,
  cashbackUsado = 0,
  forma,
}: Comanda): string | null {
  if (!itens.length)
    return 'Inclua pelo menos um serviço ou produto antes de receber.';
  const { subtotal } = totalDaComanda({ itens });
  if (emCentavos(desconto) > emCentavos(subtotal)) {
    return 'O desconto não pode ser maior que o valor da comanda.';
  }
  if (emCentavos(desconto) + emCentavos(cashbackUsado) > emCentavos(subtotal)) {
    return 'O cashback não pode passar do valor da comanda.';
  }
  if (!FORMAS_DE_PAGAMENTO.some((f) => f.valor === forma))
    return 'Escolha a forma de pagamento.';
  return null;
}

/**
 * Resumo do caixa: recebido por forma de pagamento (só comandas pagas), total,
 * dinheiro esperado na gaveta (troco inicial + vendas em dinheiro + entradas −
 * saídas) e comandas em aberto. `movimentos` são as saídas e entradas da gaveta
 * vindas do financeiro (planejamento 0027, parte 2): [{ tipo, valor }].
 */
export function resumoDoCaixa({
  valorInicial = 0,
  comandas = [],
  movimentos = [],
}: {
  valorInicial?: Valor;
  comandas?: Comanda[];
  movimentos?: MovimentoDeCaixa[];
}) {
  const porForma = Object.fromEntries(
    FORMAS_DE_PAGAMENTO.map((f) => [f.valor, 0]),
  );
  let pagas = 0;
  // Cashback (planejamento 0037): abate como desconto, fora da gaveta, mas
  // aparece numa linha própria no resumo e no fechamento.
  let cashback = 0;
  for (const c of comandas) {
    if (c.estado !== 'paga') continue;
    const t = totalDaComanda(c);
    porForma[String(c.forma)] += emCentavos(t.total);
    cashback += emCentavos(t.cashback);
    pagas += 1;
  }
  const total = Object.values(porForma).reduce((a, b) => a + b, 0);
  const soma = (tipo: string) =>
    movimentos
      .filter((m) => m.tipo === tipo)
      .reduce((a, m) => a + emCentavos(m.valor), 0);
  const saidas = soma('saida');
  const entradas = soma('entrada');
  return {
    porForma: Object.fromEntries(
      Object.entries(porForma).map(([f, c]) => [f, emReais(c)]),
    ),
    totalRecebido: emReais(total),
    cashback: emReais(cashback),
    saidas: emReais(saidas),
    entradas: emReais(entradas),
    dinheiroEsperado: emReais(
      emCentavos(valorInicial) + porForma.dinheiro + entradas - saidas,
    ),
    pagas,
    abertas: comandas.filter((c) => c.estado === 'aberta').length,
  };
}

/** Diferença entre o dinheiro contado e o esperado (positivo = sobra). */
export const diferencaDeCaixa = (contado: Valor, esperado: Valor): number =>
  emReais(emCentavos(contado) - emCentavos(esperado));

/**
 * Resumo das comandas de um cliente: só as pagas contam. Totais por tipo são o
 * valor bruto dos itens; o desconto entra só no total gasto.
 * `comandas` em qualquer ordem, cada uma com `data` (AAAA-MM-DD) e `hora`.
 */
export function resumoDeComandas(comandas: Comanda[] = []) {
  const pagas = comandas
    .filter((c) => c.estado === 'paga')
    .sort((a, b) => (`${a.data} ${a.hora}` < `${b.data} ${b.hora}` ? 1 : -1));
  let servicos = 0;
  let produtos = 0;
  let total = 0;
  for (const c of pagas) {
    const t = totalDaComanda(c);
    servicos += emCentavos(t.servicos);
    produtos += emCentavos(t.produtos);
    total += emCentavos(t.total);
  }
  let ultimoServico: {
    nome: string | undefined;
    data: string | undefined;
    barbeiroId: number | null | undefined;
  } | null = null;
  for (const c of pagas) {
    const item = (c.itens ?? []).find((i) => i.tipo === 'servico');
    if (item) {
      ultimoServico = {
        nome: item.nome,
        data: c.data,
        barbeiroId: c.barbeiroId,
      };
      break;
    }
  }
  return {
    comandas: pagas.length,
    totalServicos: emReais(servicos),
    totalProdutos: emReais(produtos),
    totalGasto: emReais(total),
    ticketMedio: pagas.length ? emReais(Math.round(total / pagas.length)) : 0,
    ultimaVisita: pagas[0]?.data ?? null,
    ultimoServico,
  };
}
