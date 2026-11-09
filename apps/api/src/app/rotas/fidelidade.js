import { agora } from '../../servicos/agenda.js';
import {
  extratoDoCliente,
  obterConfig,
  saldoDoCliente,
  salvarConfig,
} from '../../servicos/fidelidade.js';
import { corpo, escalar, inteiro, logico } from '../esquemas.js';

// Fidelidade no banco (planejamento 0034, etapa A). Tudo exige o módulo
// "fidelidade" ativo (ADR 0011); configurar exige fidelidade.gerenciar.
export default async function (fastify) {
  const modulo = fastify.exigirModulo('fidelidade');
  const na = (req, fn) => fastify.naBarbearia(req, fn);

  // A comanda (caixa.operar) também lê a configuração: prêmio e regras.
  fastify.get(
    '/fidelidade/config',
    {
      preHandler: [
        fastify.exigirAlguma('fidelidade.gerenciar', 'caixa.operar'),
        modulo,
      ],
    },
    (req) => na(req, (c) => obterConfig(c)),
  );

  const lado = {
    type: ['object', 'null'],
    properties: {
      ativo: logico,
      necessarios: escalar(),
      premioServicoId: inteiro,
      validadeMeses: escalar(),
      percentual: escalar(),
      validadeDias: escalar(),
    },
  };
  fastify.put(
    '/fidelidade/config',
    {
      preHandler: [fastify.exigir('fidelidade.gerenciar'), modulo],
      schema: corpo({ selos: lado, cashback: lado }),
    },
    (req) =>
      na(req, (c) => salvarConfig(c, req.contexto.barbeariaId, req.body ?? {})),
  );

  /** Saldo e extrato do cliente (cadastro do cliente e comanda). */
  fastify.get(
    '/clientes/:id/fidelidade',
    {
      preHandler: [
        fastify.exigirAlguma('clientes.ver', 'caixa.operar'),
        modulo,
      ],
    },
    (req) =>
      na(req, async (c) => {
        const id = Number(req.params.id);
        const [saldo, extrato] = await Promise.all([
          saldoDoCliente(c, id, agora().data),
          extratoDoCliente(c, id),
        ]);
        return { saldo, extrato };
      }),
  );
}
