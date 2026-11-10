import { nivelDoPapel, permissoesDoPapel } from '@barbertime/dominio';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';

/** Papel como a tela de usuários e papéis o recebe (`GET /papeis`). */
export interface PapelDaBarbearia {
  id: number;
  chave: string;
  nome: string;
  /** Quantas pessoas têm o papel nesta barbearia. */
  usuarios: number;
  nivel: number | null;
  protegido: true;
  permissoes: string[];
}

/**
 * Papéis: só leitura (ADR 0010, planejamento 0023). A hierarquia é fixa
 * (Dono > Gerente > Recepção > Barbeiro) e não se cria, edita nem exclui papel.
 * As permissões mostradas vêm do domínio, não do banco.
 */
export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/papeis',
    { preHandler: fastify.exigir('usuarios.gerenciar') },
    (req): Promise<PapelDaBarbearia[]> =>
      fastify.naBarbearia(req, async (c) => {
        const rows = await c.db
          .selectFrom('papeis as p')
          .select((eb) => [
            'p.id',
            'p.chave',
            'p.nome',
            eb
              .selectFrom('vinculos as v')
              .select(sql<number>`count(*)::int`.as('n'))
              .whereRef('v.papelId', '=', 'p.id')
              .$asScalar()
              .$notNull()
              .as('usuarios'),
          ])
          .execute();
        return (
          rows
            .map((p) => ({
              ...p,
              nivel: nivelDoPapel(p.chave),
              protegido: true as const,
              permissoes: permissoesDoPapel(p.chave),
            }))
            // Como antes: chave desconhecida (nivel null) conta como 0.
            .sort((a, b) => Number(a.nivel) - Number(b.nivel))
        );
      }),
  );
}
