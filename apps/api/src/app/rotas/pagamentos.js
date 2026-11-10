import { invalido } from '../../infra/erros.ts';
import { provedorSimulado } from '../../pagamentos/provedores.js';
import { corpo, escalar, texto } from '../esquemas.ts';

/** Módulo adicional "Pagamento online" (ADR 0011). Provedor real: a definir. */
export default async function (
  fastify,
  { provedor = provedorSimulado() } = {},
) {
  const acesso = {
    preHandler: [
      fastify.exigirModulo('pagamentos_online'),
      fastify.exigir('pagamentos.operar'),
    ],
  };

  fastify.post(
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
