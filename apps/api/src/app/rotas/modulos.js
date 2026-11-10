import { MODULOS, transicaoDeModulo } from '@barbertime/dominio';
import { invalido, naoEncontrado, proibido } from '../../infra/erros.ts';

const ACOES_DA_BARBEARIA = [
  'ativar',
  'desativar',
  'solicitar',
  'cancelar_solicitacao',
];

async function listar(c) {
  const { rows } = await c.query(
    'select modulo, estado, atualizado_em from barbearia_modulos',
  );
  const estados = new Map(rows.map((r) => [r.modulo, r]));
  return MODULOS.map((m) => ({
    ...m,
    estado: estados.get(m.chave)?.estado ?? 'inativo',
    atualizadoEm: estados.get(m.chave)?.atualizado_em ?? null,
  }));
}

export default async function (fastify) {
  /** Catálogo com o estado de cada módulo nesta barbearia. */
  fastify.get('/modulos', { preHandler: fastify.autenticado }, (req) =>
    fastify.naBarbearia(req, listar),
  );

  /**
   * Ações da barbearia sobre um módulo. A confirmação de contratação de um
   * serviço adicional é feita pela equipe BarberTime (super admin), não aqui.
   */
  fastify.post(
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
        await c.query(
          `insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, $2, $3)
           on conflict (barbearia_id, modulo)
           do update set estado = excluded.estado, atualizado_em = now()`,
          [req.contexto.barbeariaId, chave, estado],
        );
        return (await listar(c)).find((m) => m.chave === chave);
      });
    },
  );
}
