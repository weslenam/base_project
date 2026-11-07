import { randomUUID } from 'node:crypto';

/**
 * Interface de provedor de pagamento (ADR 0011). O gateway real (Asaas, Mercado Pago,
 * Pagar.me...) será escolhido depois e implementará o mesmo contrato:
 *   criarCobranca({ valor, descricao }) → { id, valor, descricao, status, link }
 *   consultarCobranca(id) → { id, status }
 *   tratarWebhook(corpo, cabecalhos) → { id, status }
 */
export function provedorSimulado() {
  const cobrancas = new Map();
  return {
    nome: 'simulado',
    async criarCobranca({ valor, descricao }) {
      const id = randomUUID();
      const cobranca = {
        id,
        valor,
        descricao,
        status: 'pendente',
        link: `https://pagamento.exemplo/${id}`,
      };
      cobrancas.set(id, cobranca);
      return cobranca;
    },
    async consultarCobranca(id) {
      return cobrancas.get(id) ?? null;
    },
    async tratarWebhook(corpo) {
      const c = cobrancas.get(corpo?.id);
      if (c) c.status = corpo.status;
      return c ?? null;
    },
  };
}
