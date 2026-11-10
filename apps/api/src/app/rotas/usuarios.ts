import { podeAgirSobre } from '@barbertime/dominio';
import { sql } from 'kysely';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  conflito,
  invalido,
  naoEncontrado,
  proibido,
} from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';
import { validarNovoUsuario } from '../../servicos/barbearias.ts';
import type { DadosDeNovoUsuario } from '../../servicos/barbearias.ts';
import { TAM, corpo, inteiro, logico, texto } from '../esquemas.ts';

/** Pessoa com acesso à barbearia (`GET /usuarios` e respostas das ações). */
export interface UsuarioDaBarbearia {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  papelId: number;
  papelNome: string;
  papelChave: string;
  dono: boolean;
}

/** Usuários com vínculo nesta barbearia (a RLS limita os vínculos). */
const listar = (c: Conexao) =>
  c.db
    .selectFrom('vinculos as v')
    .innerJoin('usuarios as u', 'u.id', 'v.usuarioId')
    .innerJoin('papeis as p', 'p.id', 'v.papelId')
    .select([
      'u.id',
      'u.nome',
      'u.email',
      'v.ativo',
      'p.id as papelId',
      'p.nome as papelNome',
      'p.chave as papelChave',
      sql<boolean>`p.chave = 'dono'`.as('dono'),
    ]);

const doUsuario = (
  c: Conexao,
  id: number,
): Promise<UsuarioDaBarbearia | undefined> =>
  listar(c).where('u.id', '=', id).executeTakeFirst();

/**
 * Hierarquia fixa (ADR 0010, planejamento 0023): só se age sobre quem está
 * ABAIXO, nunca acima nem na lateral. Vale para o papel dado, o papel atual do
 * alvo e o papel novo. Ninguém dá o papel Dono, e o Dono é intocável.
 * Senha de outra pessoa: não existe rota; cada um troca a sua em Meu perfil ou
 * recupera por e-mail.
 */
function exigirAbaixo(
  req: FastifyRequest,
  chaveDoAlvo: string,
  mensagem: string,
): void {
  if (!podeAgirSobre(req.contexto.papel.chave, chaveDoAlvo))
    throw proibido(mensagem);
}
const SO_ABAIXO = 'Você só pode dar papéis abaixo do seu.';
const SO_QUEM_ESTA_ABAIXO =
  'Você só pode alterar o acesso de quem está abaixo de você.';

async function papelPorId(
  c: Conexao,
  id: number,
): Promise<{ id: number; chave: string } | null> {
  const papel = await c.db
    .selectFrom('papeis')
    .select(['id', 'chave'])
    .where('id', '=', id)
    .executeTakeFirst();
  return papel ?? null;
}

type ComId = { Params: { id: string } };

export default async function (fastify: FastifyInstance) {
  const acesso = { preHandler: fastify.exigir('usuarios.gerenciar') };

  fastify.get(
    '/usuarios',
    acesso,
    (req): Promise<UsuarioDaBarbearia[]> =>
      fastify.naBarbearia(req, (c) => listar(c).orderBy('u.nome').execute()),
  );

  /** Convida: cria a conta (com senha inicial) ou vincula conta existente pelo e-mail. */
  fastify.post<{
    Body: (DadosDeNovoUsuario & { papelId?: number | null }) | undefined;
  }>(
    '/usuarios',
    {
      ...acesso,
      schema: corpo({
        nome: texto(TAM.nome),
        email: texto(TAM.email),
        senha: texto(TAM.senha),
        papelId: inteiro,
      }),
    },
    async (req, reply) => {
      const { nome, email, senha, papelId } = req.body ?? {};
      return fastify.naBarbearia(req, async (c) => {
        const papel = await papelPorId(c, Number(papelId));
        if (!papel) throw invalido('Escolha o papel do usuário.');
        exigirAbaixo(req, papel.chave, SO_ABAIXO);

        let usuario = await c.db
          .selectFrom('usuarios')
          .select('id')
          .where((eb) =>
            eb(
              eb.fn('lower', ['email']),
              '=',
              eb.fn('lower', [eb.val(String(email ?? ''))]),
            ),
          )
          .executeTakeFirst();
        if (!usuario) {
          const novo = { nome, email, senha };
          validarNovoUsuario(novo);
          usuario = {
            id: await fastify.identidade.criarConta(c, {
              nome: novo.nome.trim(),
              email: novo.email.trim(),
              senha: novo.senha,
            }),
          };
        }
        const ja = await c.db
          .selectFrom('vinculos')
          .select(sql`1`.as('ja'))
          .where('usuarioId', '=', usuario.id)
          .executeTakeFirst();
        if (ja) throw conflito('Esse e-mail já tem acesso a esta barbearia.');
        await c.db
          .insertInto('vinculos')
          .values({
            barbeariaId: req.contexto.barbeariaId,
            usuarioId: usuario.id,
            papelId: papel.id,
          })
          .execute();
        reply.code(201);
        return doUsuario(c, usuario.id);
      });
    },
  );

  /** Troca o papel ou ativa/desativa o acesso de quem está abaixo. */
  fastify.put<
    ComId & {
      Body: { papelId?: number | null; ativo?: boolean | null } | undefined;
    }
  >(
    '/usuarios/:id',
    { ...acesso, schema: corpo({ papelId: inteiro, ativo: logico }) },
    async (req) => {
      const id = Number(req.params.id);
      if (id === req.contexto.usuarioId)
        throw proibido('Você não pode alterar o próprio acesso.');
      const { papelId, ativo } = req.body ?? {};
      return fastify.naBarbearia(req, async (c) => {
        const atual = await doUsuario(c, id);
        if (!atual)
          throw naoEncontrado('Usuário não encontrado nesta barbearia.');
        exigirAbaixo(req, atual.papelChave, SO_QUEM_ESTA_ABAIXO);
        const papel = papelId
          ? await papelPorId(c, Number(papelId))
          : { id: atual.papelId, chave: atual.papelChave };
        if (!papel) throw invalido('Papel não encontrado.');
        exigirAbaixo(req, papel.chave, SO_ABAIXO);
        await c.db
          .updateTable('vinculos')
          .set({ papelId: papel.id, ativo: ativo ?? atual.ativo })
          .where('usuarioId', '=', id)
          .execute();
        return doUsuario(c, id);
      });
    },
  );

  /** Remove o acesso à barbearia de quem está abaixo (a conta continua existindo). */
  fastify.delete<ComId>('/usuarios/:id', acesso, async (req, reply) => {
    const id = Number(req.params.id);
    if (id === req.contexto.usuarioId)
      throw proibido('Você não pode remover o próprio acesso.');
    await fastify.naBarbearia(req, async (c) => {
      const atual = await doUsuario(c, id);
      if (!atual)
        throw naoEncontrado('Usuário não encontrado nesta barbearia.');
      exigirAbaixo(req, atual.papelChave, SO_QUEM_ESTA_ABAIXO);
      await c.db.deleteFrom('vinculos').where('usuarioId', '=', id).execute();
    });
    reply.code(204);
  });
}
