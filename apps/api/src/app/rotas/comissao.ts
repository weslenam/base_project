import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Conexao } from '../../infra/banco.ts';
import { agora } from '../../servicos/agenda.ts';
import {
  fecharComissao,
  listarComissoes,
} from '../../servicos/comissao.ts';
import { campoData, corpo, inteiro, query } from '../esquemas.ts';
import { invalido } from '../../infra/erros.ts';

// Comissão por barbeiro (planejamento 0042): listagem e fechamento de período.
// Exige financeiro.gerenciar (Dono e Gerente com módulo financeiro ativo).
export default async function (fastify: FastifyInstance) {
  const gerenciar = { preHandler: fastify.exigir('financeiro.gerenciar') };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);
  const barbearia = (req: FastifyRequest) => req.contexto.barbeariaId;
  const usuario = (req: FastifyRequest) => req.contexto.usuarioId;
  const hoje = () => agora().data;

  fastify.get<{ Querystring: { de?: string; ate?: string; barbeiroId?: number } }>(
    '/comissao',
    {
      ...gerenciar,
      schema: query({
        de: { ...campoData, type: ['string', 'null'] },
        ate: { ...campoData, type: ['string', 'null'] },
        barbeiroId: { ...inteiro },
      }),
    },
    (req) =>
      na(req, (c) => {
        const h = hoje();
        const de = req.query.de || h;
        const ate = req.query.ate || h;
        if (de > ate) throw invalido('O início não pode ser depois do fim.');
        return listarComissoes(
          c,
          barbearia(req),
          de,
          ate,
          req.query.barbeiroId ? Number(req.query.barbeiroId) : undefined,
        );
      }),
  );

  fastify.post<{
    Body: { barbeiroId: number; de: string; ate: string } | null;
  }>(
    '/comissao/fechar',
    {
      ...gerenciar,
      schema: corpo({
        barbeiroId: { type: 'integer' },
        de: campoData,
        ate: campoData,
      }),
    },
    async (req, reply) => {
      reply.code(201);
      return na(req, (c) => {
        const { barbeiroId, de, ate } = req.body ?? {};
        if (!barbeiroId || !de || !ate)
          throw invalido('barbeiroId, de e ate são obrigatórios.');
        if (de > ate) throw invalido('O início não pode ser depois do fim.');
        return fecharComissao(
          c,
          barbearia(req),
          barbeiroId,
          de,
          ate,
          usuario(req),
        );
      });
    },
  );
}
