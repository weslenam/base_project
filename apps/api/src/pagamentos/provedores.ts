import { randomUUID } from 'node:crypto';

/** Cobrança no provedor de pagamento. */
export interface Cobranca {
  id: string;
  valor: number;
  descricao: string;
  status: string;
  link: string;
}

/**
 * Interface de provedor de pagamento (ADR 0011). O gateway real (Asaas, Mercado Pago,
 * Pagar.me...) será escolhido depois e implementará o mesmo contrato:
 *   criarCobranca({ valor, descricao }) → { id, valor, descricao, status, link }
 *   consultarCobranca(id) → { id, status }
 *   tratarWebhook(corpo, cabecalhos) → { id, status }
 */
export interface ProvedorDePagamento {
  nome: string;
  criarCobranca(dados: { valor: number; descricao: string }): Promise<Cobranca>;
  consultarCobranca(id: string): Promise<Cobranca | null>;
  tratarWebhook(corpo: unknown): Promise<Cobranca | null>;
}

export function provedorSimulado(): ProvedorDePagamento {
  const cobrancas = new Map<string, Cobranca>();
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
      const dados = corpo as { id?: string; status?: string } | null;
      const c = dados?.id === undefined ? undefined : cobrancas.get(dados.id);
      if (c) c.status = dados?.status as string;
      return c ?? null;
    },
  };
}
