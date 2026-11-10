import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { CreateRateLimitOptions } from '@fastify/rate-limit';
import type { FastifyRequest } from 'fastify';
import { muitasRequisicoes } from '../infra/erros.ts';

const MINUTO = 60_000;

/**
 * Limites de requisição (ADR 0014, planejamento 0022). `janela` em ms.
 * Os limites por rota somam-se ao global e usam chaves combinadas (IP, e-mail,
 * telefone, barbearia): um ataque distribuído contra uma conta ou uma barbearia
 * também é barrado, não só o que vem de um IP.
 */
/** Limite: máximo de pedidos numa janela (ms). */
export interface Limite {
  max: number;
  janela: number;
}

export const LIMITES_PADRAO = Object.freeze({
  global: { max: 300, janela: MINUTO },
  entrarPorIp: { max: 20, janela: 15 * MINUTO },
  entrarPorEmail: { max: 5, janela: 15 * MINUTO },
  cadastroPorIp: { max: 5, janela: 60 * MINUTO },
  senhaPorIp: { max: 10, janela: 15 * MINUTO },
  publicoPorIp: { max: 60, janela: MINUTO },
  reconhecerPorIp: { max: 10, janela: 10 * MINUTO },
  reconhecerPorBarbearia: { max: 100, janela: 60 * MINUTO },
  agendarPorIp: { max: 5, janela: 10 * MINUTO },
  agendarPorTelefone: { max: 3, janela: 60 * MINUTO },
  esqueciPorIp: { max: 5, janela: 15 * MINUTO },
  esqueciPorEmail: { max: 3, janela: 60 * MINUTO },
  redefinirPorIp: { max: 10, janela: 15 * MINUTO },
  operadorPorIp: { max: 10, janela: 15 * MINUTO },
  operadorPorEmail: { max: 5, janela: 15 * MINUTO },
} satisfies Record<string, Limite>);

/** Nome de um limite do catálogo (o TypeScript pega nome errado em `limitar`). */
export type NomeDoLimite = keyof typeof LIMITES_PADRAO;

/** Normalizações das chaves: o atacante não escapa trocando caixa ou máscara. */
type Corpo = { email?: unknown; cliente?: { telefone?: unknown } } | undefined;

export const chaves = {
  ip: (req: FastifyRequest) => req.ip,
  email: (req: FastifyRequest) =>
    String((req.body as Corpo)?.email ?? '')
      .trim()
      .toLowerCase(),
  slug: (req: FastifyRequest) =>
    String((req.params as { slug?: unknown })?.slug ?? '').toLowerCase(),
  telefoneDoCliente: (req: FastifyRequest) =>
    String((req.body as Corpo)?.cliente?.telefone ?? '').replace(/\D/g, ''),
};

/**
 * Registra o limite global e decora `fastify.limitar(nome, chave)`, que devolve
 * um preHandler com store próprio. Vários podem ser empilhados na mesma rota
 * (o `fastify.rateLimit` do plugin para no primeiro; o `createRateLimit`, não).
 */
export default fp(async function limites(
  fastify,
  { limites = {} }: { limites?: Record<string, Limite> } = {},
) {
  const valores: Record<string, Limite> = { ...LIMITES_PADRAO, ...limites };

  await fastify.register(rateLimit, {
    global: true,
    max: valores.global?.max,
    timeWindow: valores.global?.janela,
    cache: 10_000,
    errorResponseBuilder: () => muitasRequisicoes(),
  });

  fastify.decorate(
    'limitar',
    (nome: string, chave: (req: FastifyRequest) => string) => {
      const limite = valores[nome];
      if (!limite) throw new Error(`Limite "${nome}" não existe.`);
      const { max, janela } = limite;
      // `cache` não está nos tipos do createRateLimit, mas a lib o aceita.
      const opcoes = {
        max,
        timeWindow: janela,
        cache: 10_000,
        keyGenerator: (req: FastifyRequest) => `${nome}:${chave(req)}`,
      } as CreateRateLimitOptions;
      const verificar = fastify.createRateLimit(opcoes);
      return async (
        req: FastifyRequest,
        reply: import('fastify').FastifyReply,
      ) => {
        const r = await verificar(req);
        if (!r.isAllowed && r.isExceeded) {
          reply.header('retry-after', r.ttlInSeconds);
          throw muitasRequisicoes();
        }
      };
    },
  );
});
