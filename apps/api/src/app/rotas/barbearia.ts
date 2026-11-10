import {
  mesclarConfigBarbearia,
  SLUG,
  validarConfigBarbearia,
} from '@barbertime/dominio';
import type {
  ConfigBarbearia,
  ConfigBarbeariaGravada,
} from '@barbertime/dominio';
import type { FastifyInstance } from 'fastify';
import { conflito, invalido } from '../../infra/erros.ts';
import { TAM, corpo, texto } from '../esquemas.ts';

// `barbearias` é tabela global (sem RLS por barbearia): as consultas daqui
// rodam no pool, fora de transação, com o driver pg (planejamento 0040).
const LER =
  'select id, nome, slug, configuracoes, token_publico from barbearias where id = $1';

interface LinhaDaBarbearia {
  id: number;
  nome: string;
  slug: string;
  configuracoes: ConfigBarbeariaGravada;
  token_publico: string;
}

/** Barbearia atual como a tela de configurações a recebe. */
export interface BarbeariaConfigurada {
  id: number;
  nome: string;
  slug: string;
  configuracoes: ConfigBarbearia;
  /** Código do link da página no modo "só com o link" (ADR 0013). */
  tokenPublico: string;
}

const formatar = (b: LinhaDaBarbearia): BarbeariaConfigurada => ({
  id: b.id,
  nome: b.nome,
  slug: b.slug,
  configuracoes: mesclarConfigBarbearia(b.configuracoes),
  tokenPublico: b.token_publico,
});

interface CorpoDaBarbearia {
  nome?: string | null;
  slug?: string | null;
  configuracoes?: ConfigBarbeariaGravada;
}

/** Configurações da barbearia atual (planejamento 0017, ADR 0012). */
export default async function (
  fastify: FastifyInstance,
  { paginaPublicaLiberada = false }: { paginaPublicaLiberada?: boolean } = {},
) {
  const acesso = { preHandler: fastify.exigir('barbearia.configurar') };

  fastify.get(
    '/barbearia',
    acesso,
    async (
      req,
    ): Promise<BarbeariaConfigurada & { paginaPublicaLiberada: boolean }> => {
      const { rows } = await fastify.db.query<LinhaDaBarbearia>(LER, [
        req.contexto.barbeariaId,
      ]);
      // A tela avisa quando a página pública está travada no sistema todo.
      return {
        ...formatar(rows[0] as LinhaDaBarbearia),
        paginaPublicaLiberada,
      };
    },
  );

  fastify.put<{ Body: CorpoDaBarbearia | undefined }>(
    '/barbearia',
    {
      ...acesso,
      schema: corpo({
        nome: texto(TAM.nome),
        slug: texto(TAM.slug),
        configuracoes: { type: ['object', 'null'] },
      }),
    },
    async (req): Promise<BarbeariaConfigurada> => {
      const { nome, slug, configuracoes } = req.body ?? {};
      if (!String(nome ?? '').trim())
        throw invalido('Informe o nome da barbearia.');
      if (!SLUG.test(String(slug ?? ''))) {
        throw invalido(
          'O endereço deve ter só letras minúsculas, números e hífens (ex.: barbearia-do-ze).',
        );
      }
      const config = mesclarConfigBarbearia(configuracoes);
      const motivo = validarConfigBarbearia(config);
      if (motivo) throw invalido(motivo);

      const id = req.contexto.barbeariaId;
      const ja = await fastify.db.query(
        'select 1 from barbearias where slug = $1 and id <> $2',
        [slug, id],
      );
      if (ja.rowCount)
        throw conflito(`O endereço "${slug}" já está em uso. Escolha outro.`);

      const { rows } = await fastify.db.query<LinhaDaBarbearia>(
        `update barbearias set nome = $2, slug = $3, configuracoes = $4
        where id = $1 returning id, nome, slug, configuracoes, token_publico`,
        [id, String(nome).trim(), slug, config],
      );
      return formatar(rows[0] as LinhaDaBarbearia);
    },
  );

  /** Gera um código novo: o link antigo ("só com o link") deixa de funcionar. */
  fastify.post(
    '/barbearia/token',
    acesso,
    async (req): Promise<BarbeariaConfigurada> => {
      const { rows } = await fastify.db.query<LinhaDaBarbearia>(
        `update barbearias set token_publico = replace(gen_random_uuid()::text, '-', '')
        where id = $1 returning id, nome, slug, configuracoes, token_publico`,
        [req.contexto.barbeariaId],
      );
      return formatar(rows[0] as LinhaDaBarbearia);
    },
  );
}
