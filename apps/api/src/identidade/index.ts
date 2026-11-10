import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { config } from '../infra/config.ts';
import type { Identidade } from '../app/tipos-fastify.ts';
import { criarIdentidadePropria } from './propria.ts';
import type { OpcoesDaIdentidade } from './propria.ts';

/** Opções do plugin: `auth` escolhe a implementação (padrão: AUTH do ambiente). */
export interface OpcoesDoPluginDeIdentidade extends OpcoesDaIdentidade {
  auth?: string;
}

type CriarIdentidade = (
  fastify: FastifyInstance,
  opcoes: OpcoesDaIdentidade,
) => Promise<Identidade>;

/**
 * Identidade atrás de um adaptador (ADR 0016, planejamento 0025 S3). As rotas
 * falam só com fastify.identidade; a implementação sai da variável AUTH.
 * "supabase" (GoTrue com BFF) entra na S4.
 */
export const IMPLEMENTACOES: Record<string, CriarIdentidade | undefined> = {
  propria: criarIdentidadePropria,
};

export default fp(async function identidade(
  fastify: FastifyInstance,
  opcoes: OpcoesDoPluginDeIdentidade,
) {
  const nome = opcoes.auth ?? config.auth;
  // Só as chaves próprias: `AUTH=toString` não pode pegar algo do protótipo.
  const criar = Object.hasOwn(IMPLEMENTACOES, nome)
    ? IMPLEMENTACOES[nome]
    : undefined;
  if (!criar)
    throw new Error(
      `AUTH="${nome}" não existe. Use: ${Object.keys(IMPLEMENTACOES).join(', ')}.`,
    );
  fastify.decorate('identidade', await criar(fastify, opcoes));
});
