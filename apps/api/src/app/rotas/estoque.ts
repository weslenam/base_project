import {
  ajusteDeInventario,
  arredondarQuantidade,
  documentoValido,
  sugestaoDeCompra,
} from '@barbertime/dominio';
import type { Valor } from '@barbertime/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { invalido, naoEncontrado } from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';
import {
  cancelarCompra,
  movimentar,
  obterCompra,
  registrarCompra,
  selecionarProdutosDoEstoque,
} from '../../servicos/estoque.ts';
import type { DadosDaCompra } from '../../servicos/estoque.ts';
import type {
  AjusteDeInventario,
  CompraNaLista,
  Fornecedor,
  ItemDaFicha,
  MovimentoDeEstoque,
} from '../../servicos/estoque.contratos.ts';
import {
  TAM,
  campoData,
  corpo,
  escalar,
  inteiro,
  query,
  texto,
} from '../esquemas.ts';

// Estoque, ficha técnica, fornecedores e compras (planejamento 0027, parte 1).
// As permissões estoque.* só valem com o módulo "estoque" ativo
// (permissoesEfetivas): sem ele, todas estas rotas dão 403.

const itensComProduto = (extra: Record<string, unknown>) => ({
  type: ['array', 'null'],
  maxItems: 200,
  items: {
    type: 'object',
    properties: { produtoId: inteiro, ...extra },
  },
});

type ComId = { Params: { id: string } };

/** Corpo de POST/PUT /fornecedores. */
interface DadosDoFornecedor {
  nome?: string | null;
  documento?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
}

export default async function (fastify: FastifyInstance) {
  const ver = { preHandler: fastify.exigir('estoque.ver') };
  const gerenciar = { preHandler: fastify.exigir('estoque.gerenciar') };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);
  const barbearia = (req: FastifyRequest) => req.contexto.barbeariaId;
  const usuario = (req: FastifyRequest) => req.contexto.usuarioId;

  // ---- saldos e movimentos ----
  fastify.get('/estoque', ver, (req) =>
    na(req, async (c) => {
      const linhas = await selecionarProdutosDoEstoque(c)
        .where('excluidoEm', 'is', null)
        .execute();
      const produtos = linhas.sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      );
      return { produtos, comprar: sugestaoDeCompra(produtos) };
    }),
  );

  fastify.get<{
    Querystring: { produtoId?: string | null; limite?: string | null };
  }>(
    '/estoque/movimentos',
    { ...ver, schema: query({ produtoId: escalar(), limite: escalar() }) },
    (req) =>
      na(req, async (c): Promise<MovimentoDeEstoque[]> => {
        const produtoId = Number(req.query.produtoId) || null;
        const limite = Math.min(
          200,
          Math.max(1, Number(req.query.limite) || 50),
        );
        let consulta = c.db
          .selectFrom('movimentosEstoque as m')
          .innerJoin('produtos as p', 'p.id', 'm.produtoId')
          .leftJoin('usuarios as u', 'u.id', 'm.usuarioId')
          .select([
            'm.id',
            'm.produtoId',
            'p.nome as produtoNome',
            'p.unidade',
            'm.tipo',
            'm.quantidade',
            'm.custoUnitario',
            'm.motivo',
            'm.comandaId',
            'm.compraId',
            'm.criadoEm',
          ])
          .select((eb) =>
            eb.fn.coalesce('u.nome', eb.val('')).as('usuarioNome'),
          );
        if (produtoId != null)
          consulta = consulta.where('m.produtoId', '=', produtoId);
        return consulta
          .orderBy('m.criadoEm', 'desc')
          .orderBy('m.id', 'desc')
          .limit(limite)
          .execute();
      }),
  );

  fastify.post<{
    Body: {
      produtoId?: number | null;
      quantidade?: Valor;
      motivo?: string | null;
    } | null;
  }>(
    '/estoque/consumo',
    {
      ...gerenciar,
      schema: corpo({
        produtoId: inteiro,
        quantidade: escalar(),
        motivo: texto(500),
      }),
    },
    (req) =>
      na(req, async (c) => {
        const d = req.body ?? {};
        if (!d.produtoId) throw invalido('Escolha o produto.');
        const quantidade = arredondarQuantidade(d.quantidade);
        if (!(quantidade > 0))
          throw invalido('A quantidade precisa ser maior que zero.');
        const motivo = String(d.motivo ?? '').trim();
        if (!motivo) throw invalido('Informe o motivo do consumo.');
        return movimentar(c, barbearia(req), {
          produtoId: d.produtoId,
          tipo: 'consumo_manual',
          quantidade: -quantidade,
          motivo,
          usuarioId: usuario(req),
        });
      }),
  );

  fastify.post<{
    Body: {
      itens?: { produtoId?: number | null; contado?: Valor }[] | null;
    } | null;
  }>(
    '/estoque/inventario',
    {
      ...gerenciar,
      schema: corpo({ itens: itensComProduto({ contado: escalar() }) }),
    },
    (req) =>
      na(req, async (c) => {
        const itens = req.body?.itens ?? [];
        if (!itens.length)
          throw invalido('Informe a contagem de ao menos um produto.');
        const ids = new Set<number>();
        const contagem: { produtoId: number; contado: Valor }[] = [];
        for (const i of itens) {
          if (!i.produtoId) throw invalido('Escolha o produto de cada linha.');
          if (
            i.contado === null ||
            i.contado === '' ||
            !(Number(i.contado) >= 0)
          )
            throw invalido('A quantidade contada não pode ser negativa.');
          if (ids.has(i.produtoId))
            throw invalido('Cada produto aparece uma vez só no inventário.');
          ids.add(i.produtoId);
          contagem.push({ produtoId: i.produtoId, contado: i.contado });
        }
        const ajustes: AjusteDeInventario[] = [];
        // Ordem fixa por id: travas sempre na mesma ordem.
        for (const i of contagem.sort((a, b) => a.produtoId - b.produtoId)) {
          const p = await c.db
            .selectFrom('produtos')
            .select('saldo')
            .where('id', '=', i.produtoId)
            .where('excluidoEm', 'is', null)
            .forUpdate()
            .executeTakeFirst();
          if (!p) throw invalido('Produto não encontrado.');
          const diferenca = ajusteDeInventario(p.saldo, i.contado);
          if (diferenca === null) continue;
          const r = await movimentar(c, barbearia(req), {
            produtoId: i.produtoId,
            tipo: 'ajuste_inventario',
            quantidade: diferenca,
            motivo: 'Inventário',
            usuarioId: usuario(req),
          });
          // Diferença não nula: o movimento sempre acontece.
          if (!r) continue;
          ajustes.push({
            produtoId: r.id,
            nome: r.nome,
            anterior: Number(p.saldo),
            contado: arredondarQuantidade(i.contado),
            diferenca,
          });
        }
        return { ajustes };
      }),
  );

  // ---- ficha técnica ----
  async function ficha(c: Conexao, servicoId: number): Promise<ItemDaFicha[]> {
    const s = await c.db
      .selectFrom('servicos')
      .select('id')
      .where('id', '=', servicoId)
      .where('excluidoEm', 'is', null)
      .executeTakeFirst();
    if (!s) throw naoEncontrado('Serviço não encontrado.');
    return c.db
      .selectFrom('fichasTecnicas as f')
      .innerJoin('produtos as p', 'p.id', 'f.produtoId')
      .select(['f.produtoId', 'p.nome', 'p.unidade', 'f.quantidade'])
      .select(
        // No Postgres a expressão volta boolean.
        sql<boolean>`(p.tipo = 'consumivel' and p.excluido_em is null)`.as(
          'valido',
        ),
      )
      .where('f.servicoId', '=', servicoId)
      .orderBy('p.nome')
      .execute();
  }

  fastify.get<ComId>('/servicos/:id/ficha', ver, (req) =>
    na(req, (c) => ficha(c, Number(req.params.id))),
  );

  fastify.put<
    ComId & {
      Body: {
        itens?: { produtoId?: number | null; quantidade?: Valor }[] | null;
      } | null;
    }
  >(
    '/servicos/:id/ficha',
    {
      ...gerenciar,
      schema: corpo({ itens: itensComProduto({ quantidade: escalar() }) }),
    },
    (req) =>
      na(req, async (c) => {
        const servicoId = Number(req.params.id);
        await ficha(c, servicoId);
        const itens = (req.body?.itens ?? []).map((i) => ({
          produtoId: Number(i.produtoId),
          quantidade: arredondarQuantidade(i.quantidade),
        }));
        const ids = new Set<number>();
        for (const i of itens) {
          if (!i.produtoId) throw invalido('Escolha o produto de cada linha.');
          if (!(i.quantidade > 0))
            throw invalido(
              'A quantidade de cada produto precisa ser maior que zero.',
            );
          if (ids.has(i.produtoId))
            throw invalido('Cada produto aparece uma vez só na ficha.');
          ids.add(i.produtoId);
        }
        if (itens.length) {
          const linhas = await c.db
            .selectFrom('produtos')
            .select('id')
            .where('id', 'in', [...ids])
            .where('tipo', '=', 'consumivel')
            .where('excluidoEm', 'is', null)
            .execute();
          if (linhas.length !== ids.size)
            throw invalido(
              'A ficha técnica só aceita produtos consumíveis ativos.',
            );
        }
        await c.db
          .deleteFrom('fichasTecnicas')
          .where('servicoId', '=', servicoId)
          .execute();
        for (const i of itens)
          await c.db
            .insertInto('fichasTecnicas')
            .values({
              barbeariaId: barbearia(req),
              servicoId,
              produtoId: i.produtoId,
              quantidade: i.quantidade,
            })
            .execute();
        return ficha(c, servicoId);
      }),
  );

  // ---- fornecedores ----
  const fornecedor = {
    ...gerenciar,
    schema: corpo({
      nome: texto(TAM.nome),
      documento: texto(TAM.cpf),
      telefone: texto(TAM.telefone),
      observacoes: texto(TAM.observacao),
    }),
  };

  const selecionarFornecedores = (c: Conexao) =>
    c.db
      .selectFrom('fornecedores')
      .select(['id', 'nome', 'documento', 'telefone', 'observacoes']);

  fastify.get('/fornecedores', ver, (req) =>
    na(
      req,
      (c): Promise<Fornecedor[]> =>
        selecionarFornecedores(c)
          .where('excluidoEm', 'is', null)
          .orderBy('nome')
          .execute(),
    ),
  );

  async function fornecedorAtivo(
    c: Conexao,
    id: number | string,
  ): Promise<Fornecedor> {
    const f = await selecionarFornecedores(c)
      .where('id', '=', Number(id))
      .where('excluidoEm', 'is', null)
      .executeTakeFirst();
    if (!f) throw naoEncontrado('Fornecedor não encontrado.');
    return f;
  }

  /** Sem `idTexto` (POST), cadastra; com ele (PUT /fornecedores/:id), altera. */
  const salvarFornecedor = (
    req: FastifyRequest<{ Body: DadosDoFornecedor | null }>,
    idTexto?: string,
  ) =>
    na(req, async (c) => {
      const id = idTexto ? Number(idTexto) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do fornecedor.');
      const documento = String(d.documento ?? '').replace(/\D/g, '');
      if (!documentoValido(documento)) throw invalido('CPF ou CNPJ inválido.');
      const valores = {
        nome,
        documento: documento || null,
        telefone: String(d.telefone ?? '').replace(/\D/g, '') || null,
        observacoes: String(d.observacoes ?? '').trim(),
      };
      if (id) {
        await fornecedorAtivo(c, id);
        await c.db
          .updateTable('fornecedores')
          .set(valores)
          .where('id', '=', id)
          .execute();
        return fornecedorAtivo(c, id);
      }
      const novo = await c.db
        .insertInto('fornecedores')
        .values({ barbeariaId: barbearia(req), ...valores })
        .returning('id')
        .executeTakeFirstOrThrow();
      return fornecedorAtivo(c, novo.id);
    });
  fastify.post<{ Body: DadosDoFornecedor | null }>(
    '/fornecedores',
    fornecedor,
    async (req, reply) => {
      reply.code(201);
      return salvarFornecedor(req);
    },
  );
  fastify.put<ComId & { Body: DadosDoFornecedor | null }>(
    '/fornecedores/:id',
    fornecedor,
    (req) => salvarFornecedor(req, req.params.id),
  );

  fastify.delete<ComId>('/fornecedores/:id', gerenciar, async (req, reply) => {
    await na(req, async (c) => {
      const f = await fornecedorAtivo(c, req.params.id);
      await c.db
        .updateTable('fornecedores')
        .set({ excluidoEm: sql<Date>`now()` })
        .where('id', '=', f.id)
        .execute();
    });
    reply.code(204);
  });

  // ---- compras ----
  fastify.get('/compras', ver, (req) =>
    na(
      req,
      (c): Promise<CompraNaLista[]> =>
        c.db
          .selectFrom('compras as cp')
          .innerJoin('fornecedores as f', 'f.id', 'cp.fornecedorId')
          .leftJoin('contas as ct', 'ct.compraId', 'cp.id')
          .select([
            'cp.id',
            'cp.data',
            'cp.fornecedorId',
            'f.nome as fornecedorNome',
            'cp.total',
          ])
          .select((eb) => [
            // No Postgres a comparação volta boolean.
            eb('cp.canceladaEm', 'is not', null)
              .$castTo<boolean>()
              .as('cancelada'),
            eb.fn.count<number>('ct.id').as('parcelas'),
            eb.fn
              .count<number>('ct.id')
              .filterWhere('ct.situacao', '=', 'quitada')
              .as('quitadas'),
          ])
          .groupBy(['cp.id', 'f.nome'])
          .orderBy('cp.data', 'desc')
          .orderBy('cp.id', 'desc')
          .limit(500)
          .execute(),
    ),
  );

  fastify.get<ComId>('/compras/:id', ver, (req) =>
    na(req, (c) => obterCompra(c, req.params.id)),
  );

  fastify.post<{ Body: DadosDaCompra | null }>(
    '/compras',
    {
      ...gerenciar,
      schema: corpo({
        fornecedorId: inteiro,
        data: campoData,
        frete: escalar(),
        desconto: escalar(),
        observacao: texto(TAM.observacao),
        itens: itensComProduto({
          quantidade: escalar(),
          custoUnitario: escalar(),
        }),
        parcelas: {
          type: ['array', 'null'],
          maxItems: 60,
          items: {
            type: 'object',
            properties: { valor: escalar(), vencimento: campoData },
          },
        },
      }),
    },
    async (req, reply) => {
      const compra = await na(req, (c) =>
        registrarCompra(c, barbearia(req), usuario(req), req.body ?? {}),
      );
      reply.code(201);
      return compra;
    },
  );

  fastify.post<ComId>('/compras/:id/cancelar', gerenciar, (req) =>
    na(req, (c) =>
      cancelarCompra(c, barbearia(req), usuario(req), req.params.id),
    ),
  );
}
