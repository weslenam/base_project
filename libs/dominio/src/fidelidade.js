// Fidelidade (planejamento 0015): selos e/ou cashback, a barbearia escolhe.
import { totalDaComanda } from './caixa.js';
import { somarDias, somarMeses } from './agenda.js';

export const FIDELIDADE_PADRAO = Object.freeze({
  selos: {
    ativo: false,
    necessarios: 10,
    premioServicoId: null,
    validadeMeses: null,
  },
  cashback: { ativo: false, percentual: 5, validadeDias: 90 },
});

/** Motivo de configuração inválida, ou null. */
export function validarConfigFidelidade({ selos, cashback }) {
  if (selos?.ativo) {
    if (!(Number.isInteger(selos.necessarios) && selos.necessarios >= 2)) {
      return 'O cartão precisa de pelo menos 2 selos para o prêmio.';
    }
    if (!selos.premioServicoId)
      return 'Escolha o serviço que o cliente ganha ao completar os selos.';
    if (
      selos.validadeMeses != null &&
      !(Number.isInteger(selos.validadeMeses) && selos.validadeMeses >= 1)
    ) {
      return 'A validade dos selos precisa ser de pelo menos 1 mês (ou sem validade).';
    }
  }
  if (cashback?.ativo) {
    // Até 2 casas, como a coluna numeric(5,2) guarda (planejamento 0037).
    const p = cashback.percentual;
    const duasCasas = Math.abs(Math.round(p * 100) - p * 100) < 1e-6;
    if (!(p >= 0.1 && p <= 50 && duasCasas)) {
      return 'O cashback precisa ficar entre 0,1% e 50%, com até 2 casas decimais.';
    }
    if (
      !(Number.isInteger(cashback.validadeDias) && cashback.validadeDias >= 1)
    ) {
      return 'A validade do cashback precisa ser de pelo menos 1 dia.';
    }
  }
  return null;
}

/**
 * O que uma comanda credita ao cliente. Só comanda paga e com cliente
 * identificado (avulso não acumula).
 * - selo: 1 se houver ao menos um serviço PAGO (serviço usado por pacote, a R$ 0, não conta)
 * - cashback: % do total pago, arredondado para baixo no centavo
 */
export function creditosDaComanda(comanda, config, data) {
  const nada = { movimentos: [] };
  if (comanda.estado !== 'paga' || !comanda.clienteId) return nada;
  const movimentos = [];
  const temServicoPago = (comanda.itens ?? []).some(
    (i) => i.tipo === 'servico' && i.preco > 0,
  );
  if (config.selos?.ativo && temServicoPago) {
    movimentos.push({
      tipo: 'selo',
      valor: 1,
      data,
      expiraEm: config.selos.validadeMeses
        ? somarMeses(data, config.selos.validadeMeses)
        : null,
      comandaId: comanda.id,
    });
  }
  if (config.cashback?.ativo) {
    const centavos = Math.floor(
      (Math.round(totalDaComanda(comanda).total * 100) *
        config.cashback.percentual) /
        100,
    );
    if (centavos > 0) {
      movimentos.push({
        tipo: 'cashback',
        valor: centavos / 100,
        data,
        expiraEm: somarDias(data, config.cashback.validadeDias),
        comandaId: comanda.id,
      });
    }
  }
  return { movimentos };
}

/**
 * Saldo a partir do extrato do cliente. Movimentos:
 *   selo (+1) · resgate_selos (−N) · cashback (+R$) · uso_cashback (−R$)
 * Créditos vencidos (expiraEm < hoje) não contam.
 */
export function saldoDeFidelidade(movimentos, config, hoje) {
  const selos = consumirPorVencimento(
    movimentos,
    'selo',
    'resgate_selos',
    hoje,
  );
  const cashback = consumirPorVencimento(
    movimentos,
    'cashback',
    'uso_cashback',
    hoje,
  );
  const necessarios = config.selos?.necessarios ?? 0;
  const s = selos / 100;
  return {
    selos: s,
    necessarios,
    premiosDisponiveis: necessarios ? Math.floor(s / necessarios) : 0,
    faltamParaPremio: necessarios ? necessarios - (s % necessarios) : 0,
    cashback: cashback / 100,
  };
}

/**
 * Saldo (em centavos) de um tipo de crédito depois dos gastos, gastando
 * primeiro o crédito que vence antes (planejamento 0034). Cada gasto só
 * consome créditos que já existiam e ainda valiam na data dele (sem data:
 * os válidos hoje). Sobra de crédito vencido não conta.
 */
function consumirPorVencimento(movimentos, credito, gasto, hoje) {
  const valeEm = (m, dia) => !m.expiraEm || m.expiraEm >= dia;
  const creditos = movimentos
    .filter((m) => m.tipo === credito)
    .map((m) => ({ ...m, resto: Math.round(m.valor * 100) }))
    .sort((a, b) =>
      (a.expiraEm ?? '9999-12-31').localeCompare(b.expiraEm ?? '9999-12-31'),
    );
  const gastos = movimentos
    .filter((m) => m.tipo === gasto)
    .sort((a, b) => (a.data ?? hoje).localeCompare(b.data ?? hoje));
  for (const g of gastos) {
    const dia = g.data ?? hoje;
    let falta = Math.round(g.valor * 100);
    for (const c of creditos) {
      if (!falta) break;
      if (!c.resto || !valeEm(c, dia) || (c.data && c.data > dia)) continue;
      const usa = Math.min(c.resto, falta);
      c.resto -= usa;
      falta -= usa;
    }
  }
  return creditos
    .filter((c) => valeEm(c, hoje))
    .reduce((t, c) => t + c.resto, 0);
}

/** Motivo para não usar o prêmio dos selos nesta comanda, ou null se pode. */
export function motivoParaUsarPremio({ config, saldo, clienteId }) {
  if (!clienteId)
    return 'Identifique o cliente para usar o prêmio da fidelidade.';
  if (!config?.selos?.ativo || !config.selos.premioServicoId)
    return 'O cartão de selos não está ligado nesta barbearia.';
  if (!saldo || saldo.selos < config.selos.necessarios)
    return `O cliente ainda não completou o cartão (${saldo?.selos ?? 0} de ${config.selos.necessarios} selos).`;
  return null;
}

/**
 * Quanto de cashback dá para usar: o saldo, limitado ao que falta pagar da
 * comanda (subtotal menos desconto).
 */
export function limiteDeCashback({ saldo, comanda }) {
  const { subtotal, desconto } = totalDaComanda({
    ...comanda,
    cashbackUsado: 0,
  });
  const restante = Math.max(0, Math.round((subtotal - desconto) * 100));
  return Math.min(Math.round((saldo?.cashback ?? 0) * 100), restante) / 100;
}

/** Motivo para não usar este valor de cashback, ou null se pode. */
export function motivoParaUsarCashback({ valor, saldo, comanda }) {
  const v = Math.round(Number(valor || 0) * 100);
  if (!v) return null;
  if (v < 0) return 'Informe um valor de cashback válido.';
  if (!comanda.clienteId) return 'Identifique o cliente para usar o cashback.';
  if (v > Math.round((saldo?.cashback ?? 0) * 100))
    return 'O cliente não tem esse saldo de cashback.';
  if (
    v >
    Math.round(
      limiteDeCashback({ saldo: { cashback: Infinity }, comanda }) * 100,
    )
  )
    return 'O cashback não pode passar do valor da comanda.';
  return null;
}
