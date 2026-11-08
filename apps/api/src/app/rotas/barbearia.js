import {
  mesclarConfigBarbearia,
  SLUG,
  validarConfigBarbearia,
} from '@barbertime/dominio';
import { conflito, invalido } from '../../infra/erros.js';

const LER =
  'select id, nome, slug, configuracoes from barbearias where id = $1';

const formatar = (b) => ({
  id: b.id,
  nome: b.nome,
  slug: b.slug,
  configuracoes: mesclarConfigBarbearia(b.configuracoes),
});

/** Configurações da barbearia atual (planejamento 0017, ADR 0012). */
export default async function (fastify) {
  const acesso = { preHandler: fastify.exigir('barbearia.configurar') };

  fastify.get('/barbearia', acesso, async (req) => {
    const { rows } = await fastify.db.query(LER, [req.contexto.barbeariaId]);
    return formatar(rows[0]);
  });

  fastify.put('/barbearia', acesso, async (req) => {
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
        where id = $1 returning id, nome, slug, configuracoes`,
      [id, nome.trim(), slug, config],
    );
    return formatar(rows[0]);
  });
}
