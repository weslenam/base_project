import type { FastifyInstance } from 'fastify';
import { invalido } from '../../infra/erros.ts';
import { provedorSimulado } from '../../pagamentos/provedores.ts';
import type { ProvedorDePagamento } from '../../pagamentos/provedores.ts';
import { corpo, escalar, texto } from '../esquemas.ts';

/** Opções da rota (os testes trocam o provedor). */
export interface OpcoesDePagamentos {
  provedor?: ProvedorDePagamento;
}

/** Módulo adicional "Pagamento online" (ADR 0011). Provedor real: a definir. */
export default async function (
  fastify: FastifyInstance,
  { provedor = provedorSimulado() }: OpcoesDePagamentos = {},
) {
  const acesso = {
    preHandler: [
      fastify.exigirModulo('pagamentos_online'),
      fastify.exigir('pagamentos.operar'),
    ],
  };

  fastify.post<{
    Body: { valor?: string | null; descricao?: string | null } | undefined;
  }>(
    '/pagamentos/cobrancas',
    {
      ...acesso,
      schema: corpo({ valor: escalar(), descricao: texto(500) }),
    },
    async (req, reply) => {
      const valor = Number(req.body?.valor);
      if (!(valor > 0)) throw invalido('Informe o valor da cobrança.');
      reply.code(201);
      return provedor.criarCobranca({
        valor,
        descricao: String(req.body?.descricao ?? ''),
      });
    },
  );
}
