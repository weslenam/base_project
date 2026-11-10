import { saldoDeFidelidade } from '@barbertime/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Conexao } from '../../infra/banco.ts';
import { agora } from '../../servicos/agenda.ts';
import {
  extratoDoCliente,
  obterConfig,
  salvarConfig,
} from '../../servicos/fidelidade.ts';
import type { DadosDaFidelidade } from '../../servicos/fidelidade.ts';
import type { FidelidadeDoCliente } from '@barbertime/contratos';
import { corpo, escalar, inteiro, logico } from '../esquemas.ts';

// Fidelidade no banco (planejamento 0034, etapa A). Tudo exige o módulo
// "fidelidade" ativo (ADR 0011); configurar exige fidelidade.gerenciar.
export default async function (fastify: FastifyInstance) {
  const modulo = fastify.exigirModulo('fidelidade');
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);

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
  fastify.put<{ Body: DadosDaFidelidade | null }>(
    '/fidelidade/config',
    {
      preHandler: [fastify.exigir('fidelidade.gerenciar'), modulo],
      schema: corpo({ selos: lado, cashback: lado }),
    },
    (req) =>
      na(req, (c) => salvarConfig(c, req.contexto.barbeariaId, req.body ?? {})),
  );

  /** Saldo e extrato do cliente (cadastro do cliente e comanda). */
  fastify.get<{ Params: { id: string } }>(
    '/clientes/:id/fidelidade',
    {
      preHandler: [
        fastify.exigirAlguma('clientes.ver', 'caixa.operar'),
        modulo,
      ],
    },
    (req) =>
      na(req, async (c): Promise<FidelidadeDoCliente> => {
        // Um só extrato: o saldo é calculado sobre ele (planejamento 0037).
        const extrato = await extratoDoCliente(c, Number(req.params.id));
        const saldo = saldoDeFidelidade(
          extrato,
          await obterConfig(c),
          agora().data,
        );
        return { saldo, extrato };
      }),
  );
}
