import { MODULOS, transicaoDeModulo } from '@barbertime/dominio';
import type { Modulo } from '@barbertime/dominio';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import { invalido, naoEncontrado, proibido } from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';

/** Módulo do catálogo com o estado nesta barbearia (`GET /modulos`). */
export interface ModuloDaBarbearia extends Modulo {
  estado: string;
  atualizadoEm: Date | null;
}

const ACOES_DA_BARBEARIA = [
  'ativar',
  'desativar',
  'solicitar',
  'cancelar_solicitacao',
];

async function listar(c: Conexao): Promise<ModuloDaBarbearia[]> {
  const rows = await c.db
    .selectFrom('barbeariaModulos')
    .select(['modulo', 'estado', 'atualizadoEm'])
    .execute();
  const estados = new Map(rows.map((r) => [r.modulo, r]));
  return MODULOS.map((m) => ({
    ...m,
    estado: estados.get(m.chave)?.estado ?? 'inativo',
    atualizadoEm: estados.get(m.chave)?.atualizadoEm ?? null,
  }));
}

export default async function (fastify: FastifyInstance) {
  /** Catálogo com o estado de cada módulo nesta barbearia. */
  fastify.get('/modulos', { preHandler: fastify.autenticado }, (req) =>
    fastify.naBarbearia(req, listar),
  );

  /**
   * Ações da barbearia sobre um módulo. A confirmação de contratação de um
   * serviço adicional é feita pela equipe BarberTime (super admin), não aqui.
   */
  fastify.post<{ Params: { chave: string; acao: string } }>(
    '/modulos/:chave/:acao',
    { preHandler: fastify.exigir('modulos.gerenciar') },
    async (req) => {
      const { chave, acao } = req.params;
      if (acao === 'confirmar_contratacao') {
        throw proibido('A contratação é confirmada pela equipe BarberTime.');
      }
      if (!ACOES_DA_BARBEARIA.includes(acao))
        throw invalido('Ação desconhecida.');
      return fastify.naBarbearia(req, async (c) => {
        const atual = (await listar(c)).find((m) => m.chave === chave);
        if (!atual) throw naoEncontrado('Módulo desconhecido.');
        const { estado, erro } = transicaoDeModulo(chave, atual.estado, acao);
        if (erro) throw invalido(erro);
        // Sem erro, a transição sempre devolve o estado novo.
        if (estado === undefined) throw invalido('Ação desconhecida.');
        await c.db
          .insertInto('barbeariaModulos')
          .values({
            barbeariaId: req.contexto.barbeariaId,
            modulo: chave,
            estado,
          })
          .onConflict((oc) =>
            oc.columns(['barbeariaId', 'modulo']).doUpdateSet({
              estado: (eb) => eb.ref('excluded.estado'),
              atualizadoEm: sql<Date>`now()`,
            }),
          )
          .execute();
        return (await listar(c)).find((m) => m.chave === chave);
      });
    },
  );
}
