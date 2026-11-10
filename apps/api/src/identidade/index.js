import fp from 'fastify-plugin';
import { config } from '../infra/config.ts';
import { criarIdentidadePropria } from './propria.js';

/**
 * Identidade atrás de um adaptador (ADR 0016, planejamento 0025 S3). As rotas
 * falam só com fastify.identidade; a implementação sai da variável AUTH.
 * "supabase" (GoTrue com BFF) entra na S4.
 */
export const IMPLEMENTACOES = { propria: criarIdentidadePropria };

export default fp(async function identidade(fastify, opcoes) {
  const nome = opcoes.auth ?? config.auth;
  const criar = IMPLEMENTACOES[nome];
  if (!criar)
    throw new Error(
      `AUTH="${nome}" não existe. Use: ${Object.keys(IMPLEMENTACOES).join(', ')}.`,
    );
  fastify.decorate('identidade', await criar(fastify, opcoes));
});
