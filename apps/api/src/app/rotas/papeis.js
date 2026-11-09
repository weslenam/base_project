import { nivelDoPapel, permissoesDoPapel } from '@barbertime/dominio';

/**
 * Papéis: só leitura (ADR 0010, planejamento 0023). A hierarquia é fixa
 * (Dono > Gerente > Recepção > Barbeiro) e não se cria, edita nem exclui papel.
 * As permissões mostradas vêm do domínio, não do banco.
 */
export default async function (fastify) {
  fastify.get(
    '/papeis',
    { preHandler: fastify.exigir('usuarios.gerenciar') },
    (req) =>
      fastify.naBarbearia(req, async (c) => {
        const { rows } = await c.query(
          `select p.id, p.chave, p.nome,
                  (select count(*)::int from vinculos v where v.papel_id = p.id) as usuarios
             from papeis p`,
        );
        return rows
          .map((p) => ({
            ...p,
            nivel: nivelDoPapel(p.chave),
            protegido: true,
            permissoes: permissoesDoPapel(p.chave),
          }))
          .sort((a, b) => a.nivel - b.nivel);
      }),
  );
}
