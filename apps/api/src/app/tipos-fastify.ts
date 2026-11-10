// Tipos do que a API pendura no Fastify (planejamento 0040, etapa 5).
// Só tipos: nada aqui roda. As rotas e serviços em TypeScript enxergam
// `fastify.naBarbearia`, `fastify.exigir`, `req.contexto` etc. já tipados.
import type pg from 'pg';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Conexao } from '../infra/banco.ts';
import type { criarIdentidadePropria } from '../identidade/propria.js';
import type { NomeDoLimite } from '../seguranca/limites.ts';

/** Contexto da barbearia, carregado uma vez por requisição autenticada. */
export interface ContextoDaBarbearia {
  usuarioId: number;
  barbeariaId: number;
  papel: { id: number; nome: string; chave: string };
  modulosAtivos: string[];
  /** Permissões efetivas: as do papel, menos as de módulo inativo (ADR 0011). */
  permissoes: string[];
}

/** Sessão lida do cookie pela identidade (ADR 0016). */
export interface Sessao {
  usuarioId: number;
  barbeariaId: number | null;
  token: string;
}

/** Operador do Business Center (só no escopo /api/plataforma). */
export interface Operador {
  id: number;
  nome: string;
  email: string;
  token: string;
}

export type Identidade = Awaited<ReturnType<typeof criarIdentidadePropria>>;

type Guarda = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    /** Pool do pg. Fora de transação não há barbearia: só tabelas globais. */
    db: pg.Pool;
    comBarbearia<T>(
      barbeariaId: number,
      fn: (c: Conexao) => Promise<T>,
    ): Promise<T>;
    emTransacao<T>(fn: (c: Conexao) => Promise<T>): Promise<T>;
    /** Transação com o RLS da barbearia da requisição (use em toda rota da barbearia). */
    naBarbearia<T>(
      req: FastifyRequest,
      fn: (c: Conexao) => Promise<T>,
    ): Promise<T>;
    identidade: Identidade;
    autenticado: Guarda;
    exigir(...permissoes: string[]): Guarda;
    exigirAlguma(...permissoes: string[]): Guarda;
    exigirModulo(chave: string): Guarda;
    operadorAutenticado: Guarda;
    limitar(nome: NomeDoLimite, chave: (req: FastifyRequest) => string): Guarda;
  }
  interface FastifyRequest {
    sessao: Sessao | null;
    /**
     * Preenchido pelas guardas (`autenticado`, `exigir`...). Nas rotas da
     * barbearia ele sempre existe, porque toda rota tem uma guarda.
     */
    contexto: ContextoDaBarbearia;
    operador: Operador | null;
  }
}
