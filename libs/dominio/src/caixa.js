// Regras de caixa e comanda (MVP, item 5). Cálculos em centavos inteiros para não
// acumular erro de arredondamento; entrada e saída em reais (número).

export const FORMAS_DE_PAGAMENTO = Object.freeze([
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'credito', rotulo: 'Crédito' },
]);

const emCentavos = (reais) => Math.round(Number(reais || 0) * 100);
const emReais = (centavos) => centavos / 100;

/**
 * Totais de uma comanda { itens: [{ tipo, preco, quantidade }], desconto }:
 * servicos, produtos, subtotal (= servicos + produtos), desconto e total.
 */
export function totalDaComanda({ itens = [], desconto = 0 }) {
  let servicos = 0;
  let produtos = 0;
  for (const i of itens) {
    const valor = emCentavos(i.preco) * (i.quantidade ?? 1);
    if (i.tipo === 'produto') produtos += valor;
    else servicos += valor;
  }
  const subtotal = servicos + produtos;
  const descontoC = emCentavos(desconto);
  return {
    servicos: emReais(servicos),
    produtos: emReais(produtos),
    subtotal: emReais(subtotal),
    desconto: emReais(descontoC),
    total: emReais(Math.max(0, subtotal - descontoC)),
  };
}

/** Motivo pelo qual a comanda não pode ser recebida, ou null se pode. */
export function motivoParaNaoReceber({ itens = [], desconto = 0, forma }) {
  if (!itens.length)
    return 'Inclua pelo menos um serviço ou produto antes de receber.';
  const { subtotal } = totalDaComanda({ itens });
  if (emCentavos(desconto) > emCentavos(subtotal)) {
    return 'O desconto não pode ser maior que o valor da comanda.';
  }
  if (!FORMAS_DE_PAGAMENTO.some((f) => f.valor === forma))
    return 'Escolha a forma de pagamento.';
  return null;
}

/**
 * Resumo do caixa: recebido por forma de pagamento (só comandas pagas), total,
 * dinheiro esperado na gaveta (troco inicial + vendas em dinheiro) e comandas em aberto.
 */
export function resumoDoCaixa({ valorInicial = 0, comandas = [] }) {
  const porForma = Object.fromEntries(
    FORMAS_DE_PAGAMENTO.map((f) => [f.valor, 0]),
  );
  let pagas = 0;
  for (const c of comandas) {
    if (c.estado !== 'paga') continue;
    porForma[c.forma] += emCentavos(totalDaComanda(c).total);
    pagas += 1;
  }
  const total = Object.values(porForma).reduce((a, b) => a + b, 0);
  return {
    porForma: Object.fromEntries(
      Object.entries(porForma).map(([f, c]) => [f, emReais(c)]),
    ),
    totalRecebido: emReais(total),
    dinheiroEsperado: emReais(emCentavos(valorInicial) + porForma.dinheiro),
    pagas,
    abertas: comandas.filter((c) => c.estado === 'aberta').length,
  };
}

/** Diferença entre o dinheiro contado e o esperado (positivo = sobra). */
export const diferencaDeCaixa = (contado, esperado) =>
  emReais(emCentavos(contado) - emCentavos(esperado));
