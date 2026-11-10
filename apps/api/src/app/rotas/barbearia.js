import {
  mesclarConfigBarbearia,
  SLUG,
  validarConfigBarbearia,
} from '@barbertime/dominio';
import { conflito, invalido } from '../../infra/erros.ts';
import { TAM, corpo, texto } from '../esquemas.ts';

const LER =
  'select id, nome, slug, configuracoes, token_publico from barbearias where id = $1';

const formatar = (b) => ({
  id: b.id,
  nome: b.nome,
  slug: b.slug,
  configuracoes: mesclarConfigBarbearia(b.configuracoes),
  /** Código do link da página no modo "só com o link" (ADR 0013). */
  tokenPublico: b.token_publico,
});

/** Configurações da barbearia atual (planejamento 0017, ADR 0012). */
export default async function (
  fastify,
  { paginaPublicaLiberada = false } = {},
) {
  const acesso = { preHandler: fastify.exigir('barbearia.configurar') };

  fastify.get('/barbearia', acesso, async (req) => {
    const { rows } = await fastify.db.query(LER, [req.contexto.barbeariaId]);
    // A tela avisa quando a página pública está travada no sistema todo.
    return { ...formatar(rows[0]), paginaPublicaLiberada };
  });

  fastify.put(
    '/barbearia',
    {
      ...acesso,
      schema: corpo({
        nome: texto(TAM.nome),
        slug: texto(TAM.slug),
        configuracoes: { type: ['object', 'null'] },
      }),
    },
    async (req) => {
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

      const { rows } = await fastify.db.query(
        `update barbearias set nome = $2, slug = $3, configuracoes = $4
        where id = $1 returning id, nome, slug, configuracoes, token_publico`,
        [id, nome.trim(), slug, config],
      );
      return formatar(rows[0]);
    },
  );

  /** Gera um código novo: o link antigo ("só com o link") deixa de funcionar. */
  fastify.post('/barbearia/token', acesso, async (req) => {
    const { rows } = await fastify.db.query(
      `update barbearias set token_publico = replace(gen_random_uuid()::text, '-', '')
        where id = $1 returning id, nome, slug, configuracoes, token_publico`,
      [req.contexto.barbeariaId],
    );
    return formatar(rows[0]);
  });
}
