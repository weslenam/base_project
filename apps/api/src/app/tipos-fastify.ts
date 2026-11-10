// Tipos do que a API pendura no Fastify (planejamento 0040, etapa 5).
// Só tipos: nada aqui roda. As rotas e serviços em TypeScript enxergam
// `fastify.naBarbearia`, `fastify.exigir`, `req.contexto` etc. já tipados.
import type pg from 'pg';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';
import type { Conexao, ExecutorSql } from '../infra/banco.ts';
import type { NomeDoLimite } from '../seguranca/limites.ts';
import type { PapelDaSessao } from '@barbertime/contratos';

/** Contexto da barbearia, carregado uma vez por requisição autenticada. */
export interface ContextoDaBarbearia {
  usuarioId: number;
  barbeariaId: number;
  papel: PapelDaSessao;
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

/**
 * Contrato de toda implementação de identidade (ADR 0016, planejamento 0025
 * S3). As rotas falam só com `fastify.identidade`.
 */
export interface Identidade {
  nome: string;
  /** Sessão do cookie, ou null. */
  lerSessao(req: FastifyRequest): Promise<Sessao | null>;
  /** Abre a sessão e grava o cookie. */
  abrirSessao(
    reply: FastifyReply,
    usuarioId: number,
    barbeariaId: number | null,
  ): Promise<Sessao>;
  trocarBarbearia(sessao: Sessao, barbeariaId: number): Promise<unknown>;
  sair(req: FastifyRequest, reply: FastifyReply): Promise<void>;
  /** id do usuário, ou null (mesmo tempo para e-mail inexistente e senha errada). */
  conferirCredenciais(email: unknown, senha: unknown): Promise<number | null>;
  /** Cria a conta e devolve o id (`c` pode ser a transação). */
  criarConta(
    c: ExecutorSql,
    dados: { nome: string; email: string; senha: string },
  ): Promise<number>;
  /** Quantas outras sessões caíram. */
  trocarSenha(
    sessao: Sessao,
    senhaAtual: unknown,
    novaSenha: unknown,
  ): Promise<number | null>;
  /** Não revela se o e-mail existe. */
  pedirRedefinicao(email: unknown, log: FastifyBaseLogger): Promise<void>;
  redefinirSenha(token: string, senha: string): Promise<void>;
  encerrarSessoesDaBarbearia(
    c: ExecutorSql,
    barbeariaId: number,
  ): Promise<unknown>;
}

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
