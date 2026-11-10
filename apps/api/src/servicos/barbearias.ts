import { PAPEIS_PADRAO } from '@barbertime/dominio';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import { conflito, invalido } from '../infra/erros.ts';
import { SENHA_MINIMA } from '../seguranca/senha.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Dados de uma conta nova como chegam do corpo (tudo pode faltar). */
export interface DadosDeNovoUsuario {
  nome?: string | null;
  email?: string | null;
  senha?: string | null;
}

/** Conta nova já validada. */
export interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
}

/**
 * Valida nome, e-mail e senha de uma conta nova. Depois dela, os três são
 * texto: nome não vazio, e-mail no formato e senha com o tamanho mínimo.
 */
export function validarNovoUsuario(
  dados: DadosDeNovoUsuario,
): asserts dados is NovoUsuario {
  const { nome, email, senha } = dados;
  if (typeof nome !== 'string' || !nome.trim())
    throw invalido('Informe o nome.');
  if (typeof email !== 'string' || !EMAIL.test(email))
    throw invalido('Informe um e-mail válido.');
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) {
    throw invalido(
      `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
    );
  }
}

/** Corpo do cadastro self-service. */
export interface DadosDaBarbeariaNova {
  nome?: string | null;
  slug?: string | null;
  dono?: DadosDeNovoUsuario | null;
}

/** Barbearia criada, a conta do dono e o id de cada papel padrão. */
export interface BarbeariaCriada {
  barbearia: { id: number; nome: string; slug: string };
  usuarioId: number;
  papeis: Record<string, number>;
}

/**
 * Cadastro self-service: barbearia + papéis padrão + dono + módulo de
 * agendamento online ativo. Tudo numa transação.
 */
export async function criarBarbearia(
  fastify: FastifyInstance,
  { nome, slug, dono: donoInformado }: DadosDaBarbeariaNova,
): Promise<BarbeariaCriada> {
  if (typeof nome !== 'string' || !nome.trim())
    throw invalido('Informe o nome da barbearia.');
  if (typeof slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw invalido(
      'O endereço deve ter só letras minúsculas, números e hífens (ex.: barbearia-do-ze).',
    );
  }
  const dono = donoInformado ?? {};
  validarNovoUsuario(dono);

  return fastify.emTransacao(async (c) => {
    const ja = await c.db
      .selectFrom('barbearias')
      .select(sql`1`.as('ja'))
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (ja)
      throw conflito(`O endereço "${slug}" já está em uso. Escolha outro.`);
    const conta = await c.db
      .selectFrom('usuarios')
      .select(sql`1`.as('ja'))
      .where((eb) =>
        eb(
          eb.fn('lower', ['email']),
          '=',
          eb.fn('lower', [eb.val(dono.email)]),
        ),
      )
      .executeTakeFirst();
    if (conta) {
      throw conflito(
        'Já existe uma conta com este e-mail. Entre com ela para continuar.',
      );
    }

    const barbearia = await c.db
      .insertInto('barbearias')
      .values({ nome: nome.trim(), slug })
      .returning(['id', 'nome', 'slug'])
      .executeTakeFirstOrThrow();
    // A partir daqui a transação enxerga só a barbearia nova (RLS): os papéis,
    // o vínculo e o módulo são gravados nela. `set_config` é função do banco,
    // por isso vai em `sql` (com parâmetro).
    await sql`select set_config('app.barbearia_id', ${String(barbearia.id)}, true)`.execute(
      c.db,
    );

    const papeis: Record<string, number> = {};
    for (const p of PAPEIS_PADRAO) {
      const { id } = await c.db
        .insertInto('papeis')
        .values({
          barbeariaId: barbearia.id,
          chave: p.chave,
          nome: p.nome,
          protegido: p.protegido,
          permissoes: p.permissoes,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      papeis[p.chave] = id;
    }
    const papelDono = papeis.dono;
    if (papelDono === undefined)
      throw new Error('O papel Dono não está nos papéis padrão.');

    // A conta nasce na identidade (ADR 0016); vínculo e papel ficam conosco.
    const usuarioId = await fastify.identidade.criarConta(c, {
      nome: dono.nome.trim(),
      email: dono.email.trim(),
      senha: dono.senha,
    });
    await c.db
      .insertInto('vinculos')
      .values({ barbeariaId: barbearia.id, usuarioId, papelId: papelDono })
      .execute();
    await c.db
      .insertInto('barbeariaModulos')
      .values({
        barbeariaId: barbearia.id,
        modulo: 'agendamento_online',
        estado: 'ativo',
      })
      .execute();
    return { barbearia, usuarioId, papeis };
  });
}
