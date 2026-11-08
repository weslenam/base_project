import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { muitasRequisicoes } from '../infra/erros.js';

const MINUTO = 60_000;

/**
 * Limites de requisição (ADR 0014, planejamento 0022). `janela` em ms.
 * Os limites por rota somam-se ao global e usam chaves combinadas (IP, e-mail,
 * telefone, barbearia): um ataque distribuído contra uma conta ou uma barbearia
 * também é barrado, não só o que vem de um IP.
 */
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
});

/** Normalizações das chaves: o atacante não escapa trocando caixa ou máscara. */
export const chaves = {
  ip: (req) => req.ip,
  email: (req) =>
    String(req.body?.email ?? '')
      .trim()
      .toLowerCase(),
  slug: (req) => String(req.params?.slug ?? '').toLowerCase(),
  telefoneDoCliente: (req) =>
    String(req.body?.cliente?.telefone ?? '').replace(/\D/g, ''),
};

/**
 * Registra o limite global e decora `fastify.limitar(nome, chave)`, que devolve
 * um preHandler com store próprio. Vários podem ser empilhados na mesma rota
 * (o `fastify.rateLimit` do plugin para no primeiro; o `createRateLimit`, não).
 */
export default fp(async function limites(fastify, { limites = {} } = {}) {
  const valores = { ...LIMITES_PADRAO, ...limites };

  await fastify.register(rateLimit, {
    global: true,
    max: valores.global.max,
    timeWindow: valores.global.janela,
    cache: 10_000,
    errorResponseBuilder: () => muitasRequisicoes(),
  });

  fastify.decorate('limitar', (nome, chave) => {
    const { max, janela } = valores[nome];
    const verificar = fastify.createRateLimit({
      max,
      timeWindow: janela,
      cache: 10_000,
      keyGenerator: (req) => `${nome}:${chave(req)}`,
    });
    return async (req, reply) => {
      const r = await verificar(req);
      if (r.isExceeded) {
        reply.header('retry-after', r.ttlInSeconds);
        throw muitasRequisicoes();
      }
    };
  });
});
