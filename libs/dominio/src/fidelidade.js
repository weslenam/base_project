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
    if (selos.validadeMeses != null && !(selos.validadeMeses >= 1)) {
      return 'A validade dos selos precisa ser de pelo menos 1 mês (ou sem validade).';
    }
  }
  if (cashback?.ativo) {
    if (!(cashback.percentual > 0 && cashback.percentual <= 50)) {
      return 'O cashback precisa ficar entre 0,1% e 50%.';
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
  const valido = (m) => !m.expiraEm || m.expiraEm >= hoje;
  const soma = (tipo, filtro = () => true) =>
    movimentos
      .filter((m) => m.tipo === tipo && filtro(m))
      .reduce((t, m) => t + Math.round(m.valor * 100), 0);

  const selos = Math.max(
    0,
    soma('selo', valido) / 100 - soma('resgate_selos') / 100,
  );
  const necessarios = config.selos?.necessarios ?? 0;
  const cashback =
    Math.max(0, soma('cashback', valido) - soma('uso_cashback')) / 100;
  return {
    selos,
    necessarios,
    premiosDisponiveis: necessarios ? Math.floor(selos / necessarios) : 0,
    faltamParaPremio: necessarios ? necessarios - (selos % necessarios) : 0,
    cashback,
  };
}
