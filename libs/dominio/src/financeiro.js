// Contas a pagar e a receber (planejamento 0027, parte 2). Valores em reais;
// comparações em centavos para não errar no arredondamento.

export const TIPOS_DE_CONTA = Object.freeze(['pagar', 'receber']);

/** Formas de baixa. Só `dinheiro_caixa` mexe na gaveta do caixa de hoje. */
export const FORMAS_DE_BAIXA = Object.freeze([
  { valor: 'dinheiro_caixa', rotulo: 'Dinheiro do caixa' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'banco', rotulo: 'Banco (transferência ou boleto)' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'outro', rotulo: 'Outro' },
]);

const centavos = (v) => Math.round(Number(v) * 100);
// Até R$ 999.999.999,99: cabe no numeric(12,2) do banco (issue #29).
const LIMITE_CENTAVOS = 99_999_999_999;
const valorValido = (v) => {
  const c = centavos(v);
  return Number.isFinite(c) && c > 0 && c <= LIMITE_CENTAVOS;
};
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Situação para a tela: a guardada (aberta, quitada, cancelada), com "vencida"
 * calculada para a aberta com vencimento antes de hoje (não é guardada).
 */
export function situacaoDaConta(conta, hoje) {
  if (conta.situacao === 'aberta' && conta.vencimento < hoje) return 'vencida';
  return conta.situacao;
}

/** Motivo de conta inválida (lançamento manual ou edição), ou null. */
export function validarConta(conta) {
  if (!TIPOS_DE_CONTA.includes(conta.tipo))
    return 'Escolha se a conta é a pagar ou a receber.';
  if (!String(conta.descricao ?? '').trim()) return 'Informe a descrição.';
  if (!conta.categoriaId) return 'Escolha a categoria.';
  if (!valorValido(conta.valor)) return 'Informe o valor da conta.';
  if (!DATA.test(conta.vencimento ?? '')) return 'Informe o vencimento.';
  return null;
}

/** Motivo de baixa inválida, ou null. */
export function validarBaixa({ data, valorPago, forma }) {
  if (!DATA.test(data ?? '')) return 'Informe a data do pagamento.';
  if (!valorValido(valorPago)) return 'Informe o valor pago.';
  if (!FORMAS_DE_BAIXA.some((f) => f.valor === forma))
    return 'Escolha a forma de pagamento.';
  return null;
}

/**
 * Movimento de caixa de uma baixa em dinheiro da gaveta: pagar é saída,
 * receber é entrada. Outras formas não mexem no caixa (null).
 */
export function movimentoDaBaixa(conta, { forma, valorPago }) {
  if (forma !== 'dinheiro_caixa') return null;
  return {
    tipo: conta.tipo === 'pagar' ? 'saida' : 'entrada',
    valor: centavos(valorPago) / 100,
    descricao: conta.descricao,
  };
}

/** Totais de uma lista de contas para o rodapé da tela: aberto, vencido e quitado. */
export function totaisDasContas(contas, hoje) {
  const soma = { aberto: 0, vencido: 0, quitado: 0 };
  for (const c of contas) {
    // A situação já calculada pela API (data da barbearia) tem preferência.
    const s = c.situacaoAtual ?? situacaoDaConta(c, hoje);
    if (s === 'aberta') soma.aberto += centavos(c.valor);
    else if (s === 'vencida') soma.vencido += centavos(c.valor);
    else if (s === 'quitada') soma.quitado += centavos(c.valorPago ?? c.valor);
  }
  return {
    aberto: soma.aberto / 100,
    vencido: soma.vencido / 100,
    quitado: soma.quitado / 100,
  };
}
