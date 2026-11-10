import {
  TIPOS_DE_PRODUTO,
  UNIDADES,
  arredondarQuantidade,
  paraMinutos,
} from '@barbertime/dominio';
import { sql } from 'kysely';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { conflito, invalido, naoEncontrado } from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';
import { agora } from '../../servicos/agenda.ts';
import { TAM, campoHora, corpo, escalar, inteiro, texto } from '../esquemas.ts';
import type {
  Barbeiro,
  ContaDaBarbearia,
  Produto,
  ProdutoSemCusto,
  Servico,
} from './cadastros.contratos.ts';

// Serviços, produtos e equipe (planejamento 0019). Exclusão lógica: o histórico
// de agendamentos e comandas continua apontando para o registro.

/** Tabelas de cadastro com exclusão lógica (`excluido_em`). */
type TabelaDeCadastro = 'servicos' | 'produtos' | 'barbeiros';

const plural = (n: number, s: string): string => `${n} ${s}${n > 1 ? 's' : ''}`;

/** Agendamentos futuros (não cancelados nem bloqueios) que usam o registro. */
async function futurosCom(
  c: Conexao,
  coluna: 'servicoId' | 'barbeiroId',
  id: number,
): Promise<number> {
  const { n } = await c.db
    .selectFrom('atendimentos')
    .select(sql<number>`count(*)::int`.as('n'))
    .where(coluna, '=', id)
    .where('data', '>=', agora().data)
    .where('estado', 'in', ['agendado', 'chegou', 'na_fila', 'em_atendimento'])
    .executeTakeFirstOrThrow();
  return n;
}

async function negarSeEmUso(
  c: Conexao,
  coluna: 'servicoId' | 'barbeiroId',
  id: number,
  nome: string,
): Promise<void> {
  const n = await futurosCom(c, coluna, id);
  if (n) {
    throw conflito(
      `Não é possível excluir "${nome}": há ${plural(n, 'agendamento')} ${n > 1 ? 'futuros' : 'futuro'}. Cancele ou remarque antes.`,
    );
  }
}

async function nomeRepetido(
  c: Conexao,
  tabela: TabelaDeCadastro,
  nome: string,
  id: number | null,
  rotulo: string,
): Promise<void> {
  const r = await c.db
    .selectFrom(tabela)
    .select('nome')
    .where((eb) =>
      eb(eb.fn('lower', ['nome']), '=', eb.fn('lower', [eb.val(nome)])),
    )
    .where('excluidoEm', 'is', null)
    .where('id', '<>', id ?? 0)
    .executeTakeFirst();
  if (r) throw conflito(`Já existe ${rotulo} chamado "${r.nome}".`);
}

/** Registro não excluído (id e nome, comuns às três tabelas), ou 404. */
async function obterAtivo(
  c: Conexao,
  tabela: TabelaDeCadastro,
  id: number | string,
  rotulo: string,
): Promise<{ id: number; nome: string }> {
  const r = await c.db
    .selectFrom(tabela)
    .select(['id', 'nome'])
    .where('id', '=', Number(id))
    .where('excluidoEm', 'is', null)
    .executeTakeFirst();
  if (!r) throw naoEncontrado(`${rotulo} não encontrado.`);
  return r;
}

const servicos = (c: Conexao) =>
  c.db.selectFrom('servicos').select(['id', 'nome', 'duracao', 'preco']);
const produtos = (c: Conexao) =>
  c.db
    .selectFrom('produtos')
    .select([
      'id',
      'nome',
      'preco',
      'comissao',
      'tipo',
      'unidade',
      'estoqueMinimo',
      'ultimoCusto',
      'saldo',
    ]);
const barbeiros = (c: Conexao) =>
  c.db
    .selectFrom('barbeiros')
    .select([
      'id',
      'nome',
      'inicio',
      'fim',
      'comissao',
      'usuarioId',
      'emPausa',
    ]);

type ComId = { Params: { id?: string } };

interface CorpoDoServico {
  nome?: string | null;
  duracao?: string | null;
  preco?: string | null;
}
interface CorpoDoProduto {
  nome?: string | null;
  preco?: string | null;
  comissao?: string | null;
  tipo?: string | null;
  unidade?: string | null;
  estoqueMinimo?: string | null;
}
interface CorpoDoBarbeiro {
  nome?: string | null;
  inicio?: string | null;
  fim?: string | null;
  comissao?: string | null;
  usuarioId?: number | null;
}

export default async function (fastify: FastifyInstance) {
  const logado = { preHandler: fastify.autenticado };
  const catalogo = { preHandler: fastify.exigir('catalogo.gerenciar') };
  const equipe = { preHandler: fastify.exigir('equipe.gerenciar') };
  const servico = {
    ...catalogo,
    schema: corpo({
      nome: texto(TAM.nome),
      duracao: escalar(),
      preco: escalar(),
    }),
  };
  const produto = {
    ...catalogo,
    schema: corpo({
      nome: texto(TAM.nome),
      preco: escalar(),
      comissao: escalar(),
      tipo: texto(20),
      unidade: texto(5),
      estoqueMinimo: escalar(),
    }),
  };
  const barbeiro = {
    ...equipe,
    schema: corpo({
      nome: texto(TAM.nome),
      inicio: campoHora,
      fim: campoHora,
      comissao: escalar(),
      usuarioId: inteiro,
    }),
  };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);

  // ---- serviços ----
  fastify.get(
    '/servicos',
    logado,
    (req): Promise<Servico[]> =>
      na(req, (c) =>
        servicos(c).where('excluidoEm', 'is', null).orderBy('nome').execute(),
      ),
  );

  fastify.get<{ Params: { id: string } }>(
    '/servicos/:id/futuros',
    logado,
    (req) =>
      na(req, async (c) => ({
        total: await futurosCom(c, 'servicoId', Number(req.params.id)),
      })),
  );

  const salvarServico = (
    req: FastifyRequest<ComId & { Body: CorpoDoServico | undefined }>,
  ): Promise<Servico | undefined> =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do serviço.');
      if (!(Number(d.duracao) > 0))
        throw invalido('A duração precisa ser maior que zero.');
      if (!(Number(d.preco) >= 0) || d.preco === null || d.preco === '')
        throw invalido('Informe o preço do serviço.');
      await nomeRepetido(c, 'servicos', nome, id, 'um serviço');
      const valores = {
        nome,
        duracao: Math.round(Number(d.duracao)),
        preco: Number(d.preco),
      };
      if (id) {
        await obterAtivo(c, 'servicos', id, 'Serviço');
        await c.db
          .updateTable('servicos')
          .set(valores)
          .where('id', '=', id)
          .execute();
        return servicos(c).where('id', '=', id).executeTakeFirst();
      }
      return c.db
        .insertInto('servicos')
        .values({ barbeariaId: req.contexto.barbeariaId, ...valores })
        .returning(['id', 'nome', 'duracao', 'preco'])
        .executeTakeFirst();
    });
  fastify.post<ComId & { Body: CorpoDoServico | undefined }>(
    '/servicos',
    servico,
    salvarServico,
  );
  fastify.put<ComId & { Body: CorpoDoServico | undefined }>(
    '/servicos/:id',
    servico,
    salvarServico,
  );

  fastify.delete<{ Params: { id: string } }>(
    '/servicos/:id',
    catalogo,
    async (req, reply) => {
      await na(req, async (c) => {
        const s = await obterAtivo(c, 'servicos', req.params.id, 'Serviço');
        await negarSeEmUso(c, 'servicoId', s.id, s.nome);
        await c.db
          .updateTable('servicos')
          .set({ excluidoEm: sql<Date>`now()` })
          .where('id', '=', s.id)
          .execute();
      });
      reply.code(204);
    },
  );

  // ---- produtos ----
  // Custo e saldo só para quem vê o estoque (planejamento 0027).
  const semCusto = (
    req: FastifyRequest,
    p: Produto,
  ): Produto | ProdutoSemCusto => {
    if (req.contexto.permissoes.includes('estoque.ver')) return p;
    const { ultimoCusto, saldo, ...resto } = p;
    void ultimoCusto;
    void saldo;
    return resto;
  };
  /** Produto relido depois de gravar (existe: acabou de ser gravado). */
  const produtoGravado = async (c: Conexao, id: number): Promise<Produto> =>
    produtos(c).where('id', '=', id).executeTakeFirstOrThrow();

  fastify.get('/produtos', logado, (req) =>
    na(req, async (c) =>
      (
        await produtos(c)
          .where('excluidoEm', 'is', null)
          .orderBy(sql`nome collate "C"`)
          .execute()
      )
        .map((p) => semCusto(req, p))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    ),
  );

  const salvarProduto = (
    req: FastifyRequest<ComId & { Body: CorpoDoProduto | undefined }>,
  ): Promise<Produto | ProdutoSemCusto> =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do produto.');
      // Planejamento 0027: consumível (uso interno) não tem preço nem comissão.
      const tipo = d.tipo ?? 'revenda';
      if (!TIPOS_DE_PRODUTO.includes(tipo))
        throw invalido('Escolha se o produto é de revenda ou consumível.');
      const revenda = tipo === 'revenda';
      if (revenda && !(Number(d.preco) > 0))
        throw invalido('Informe o preço de venda do produto.');
      const comissao = revenda ? Number(d.comissao ?? 0) : 0;
      if (!(comissao >= 0 && comissao <= 100))
        throw invalido('A comissão precisa estar entre 0% e 100%.');
      const unidade = d.unidade ?? 'un';
      if (!UNIDADES.includes(unidade)) throw invalido('Unidade inválida.');
      const minimo = Number(d.estoqueMinimo ?? 0);
      if (!(minimo >= 0))
        throw invalido('O estoque mínimo não pode ser negativo.');
      await nomeRepetido(c, 'produtos', nome, id, 'um produto');
      const valores = {
        nome,
        preco: revenda ? Number(d.preco) : null,
        comissao,
        tipo,
        unidade,
        estoqueMinimo: arredondarQuantidade(minimo),
      };
      if (id) {
        const atual = await c.db
          .selectFrom('produtos')
          .select('tipo')
          .where('id', '=', id)
          .where('excluidoEm', 'is', null)
          .executeTakeFirst();
        if (!atual) throw naoEncontrado('Produto não encontrado.');
        if (atual.tipo === 'revenda' && tipo === 'consumivel') {
          // Contém (`@>`) no jsonb dos itens: operador do Postgres, em `sql`
          // com o id como parâmetro.
          const aberta = await c.db
            .selectFrom('comandas')
            .select(sql`1`.as('ja'))
            .where('estado', '=', 'aberta')
            .where(
              sql<boolean>`itens @> jsonb_build_array(jsonb_build_object('tipo', 'produto', 'refId', ${id}::bigint))`,
            )
            .executeTakeFirst();
          if (aberta)
            throw conflito(
              'Esse produto está numa comanda em aberto. Receba ou tire da comanda antes de virar consumível.',
            );
        }
        await c.db
          .updateTable('produtos')
          .set(valores)
          .where('id', '=', id)
          .execute();
        return semCusto(req, await produtoGravado(c, id));
      }
      const novo = await c.db
        .insertInto('produtos')
        .values({ barbeariaId: req.contexto.barbeariaId, ...valores })
        .returning('id')
        .executeTakeFirstOrThrow();
      return semCusto(req, await produtoGravado(c, novo.id));
    });
  fastify.post<ComId & { Body: CorpoDoProduto | undefined }>(
    '/produtos',
    produto,
    salvarProduto,
  );
  fastify.put<ComId & { Body: CorpoDoProduto | undefined }>(
    '/produtos/:id',
    produto,
    salvarProduto,
  );

  fastify.delete<{ Params: { id: string } }>(
    '/produtos/:id',
    catalogo,
    async (req, reply) => {
      await na(req, async (c) => {
        const p = await obterAtivo(c, 'produtos', req.params.id, 'Produto');
        await c.db
          .updateTable('produtos')
          .set({ excluidoEm: sql<Date>`now()` })
          .where('id', '=', p.id)
          .execute();
      });
      reply.code(204);
    },
  );

  // ---- equipe ----
  fastify.get(
    '/barbeiros',
    logado,
    (req): Promise<Barbeiro[]> =>
      na(req, (c) =>
        barbeiros(c).where('excluidoEm', 'is', null).orderBy('id').execute(),
      ),
  );

  /** Contas ativas da barbearia que podem ser ligadas a um barbeiro (agenda própria). */
  function contasDaBarbearia(
    c: Conexao,
    barbeariaId: number,
  ): Promise<ContaDaBarbearia[]> {
    return c.db
      .selectFrom('vinculos as v')
      .innerJoin('usuarios as u', 'u.id', 'v.usuarioId')
      .select(['u.id', 'u.nome', 'u.email'])
      .where('v.barbeariaId', '=', barbeariaId)
      .where('v.ativo', '=', true)
      .orderBy('u.nome')
      .execute();
  }
  fastify.get('/barbeiros/contas', equipe, (req) =>
    na(req, (c) => contasDaBarbearia(c, req.contexto.barbeariaId)),
  );

  /** Conta do barbeiro: precisa ser desta barbearia e não estar em outro barbeiro. */
  async function contaDoBarbeiro(
    c: Conexao,
    req: FastifyRequest,
    id: number | null,
    usuarioId: number | null,
  ): Promise<number | null> {
    if (!usuarioId) return null;
    const conta = await c.db
      .selectFrom('vinculos')
      .select(sql`1`.as('ja'))
      .where('barbeariaId', '=', req.contexto.barbeariaId)
      .where('usuarioId', '=', usuarioId)
      .where('ativo', '=', true)
      .executeTakeFirst();
    if (!conta)
      throw invalido('Essa conta não é de um usuário desta barbearia.');
    const outro = await c.db
      .selectFrom('barbeiros')
      .select('nome')
      .where('usuarioId', '=', usuarioId)
      .where('excluidoEm', 'is', null)
      .where('id', '<>', id ?? 0)
      .executeTakeFirst();
    if (outro) throw conflito(`Essa conta já está ligada a ${outro.nome}.`);
    return usuarioId;
  }

  const salvarBarbeiro = (
    req: FastifyRequest<ComId & { Body: CorpoDoBarbeiro | undefined }>,
  ): Promise<Barbeiro | undefined> =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do barbeiro.');
      const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
      const inicio = d.inicio ?? '';
      const fim = d.fim ?? '';
      if (
        !hora.test(inicio) ||
        !hora.test(fim) ||
        paraMinutos(inicio) >= paraMinutos(fim)
      )
        throw invalido('O fim do expediente precisa ser depois do início.');
      const comissao = Number(d.comissao);
      if (!(comissao >= 0 && comissao <= 100))
        throw invalido('A comissão precisa estar entre 0% e 100%.');
      const valores = { nome, inicio, fim, comissao };
      // Sem o campo no corpo, a conta ligada continua como está.
      const mudaConta = Object.hasOwn(d, 'usuarioId');
      const usuarioId = mudaConta
        ? await contaDoBarbeiro(
            c,
            req,
            id,
            d.usuarioId ? Number(d.usuarioId) : null,
          )
        : null;
      if (id) {
        await obterAtivo(c, 'barbeiros', id, 'Barbeiro');
        await c.db
          .updateTable('barbeiros')
          .set({ ...valores, ...(mudaConta ? { usuarioId } : {}) })
          .where('id', '=', id)
          .execute();
        return barbeiros(c).where('id', '=', id).executeTakeFirst();
      }
      const novo = await c.db
        .insertInto('barbeiros')
        .values({
          barbeariaId: req.contexto.barbeariaId,
          ...valores,
          usuarioId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return barbeiros(c).where('id', '=', novo.id).executeTakeFirst();
    });
  fastify.post<ComId & { Body: CorpoDoBarbeiro | undefined }>(
    '/barbeiros',
    barbeiro,
    salvarBarbeiro,
  );
  fastify.put<ComId & { Body: CorpoDoBarbeiro | undefined }>(
    '/barbeiros/:id',
    barbeiro,
    salvarBarbeiro,
  );

  fastify.delete<{ Params: { id: string } }>(
    '/barbeiros/:id',
    equipe,
    async (req, reply) => {
      await na(req, async (c) => {
        const b = await obterAtivo(c, 'barbeiros', req.params.id, 'Barbeiro');
        await negarSeEmUso(c, 'barbeiroId', b.id, b.nome);
        // Bloqueios futuros do barbeiro saem junto.
        await c.db
          .updateTable('bloqueios')
          .set({ cancelado: true })
          .where('barbeiroId', '=', b.id)
          .where('data', '>=', agora().data)
          .execute();
        await c.db
          .updateTable('barbeiros')
          .set({ excluidoEm: sql<Date>`now()` })
          .where('id', '=', b.id)
          .execute();
      });
      reply.code(204);
    },
  );
}
