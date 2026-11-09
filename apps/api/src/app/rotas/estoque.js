import {
  ajusteDeInventario,
  arredondarQuantidade,
  documentoValido,
  sugestaoDeCompra,
} from '@barbertime/dominio';
import { invalido, naoEncontrado } from '../../infra/erros.js';
import {
  SELECT_PRODUTO_ESTOQUE,
  cancelarCompra,
  movimentar,
  obterCompra,
  registrarCompra,
} from '../../servicos/estoque.js';
import {
  TAM,
  campoData,
  corpo,
  escalar,
  inteiro,
  query,
  texto,
} from '../esquemas.js';

// Estoque, ficha técnica, fornecedores e compras (planejamento 0027, parte 1).
// As permissões estoque.* só valem com o módulo "estoque" ativo
// (permissoesEfetivas): sem ele, todas estas rotas dão 403.

const FORNECEDOR = `select id, nome, documento, telefone, observacoes from fornecedores`;

const itensComProduto = (extra) => ({
  type: ['array', 'null'],
  maxItems: 200,
  items: {
    type: 'object',
    properties: { produtoId: inteiro, ...extra },
  },
});

export default async function (fastify) {
  const ver = { preHandler: fastify.exigir('estoque.ver') };
  const gerenciar = { preHandler: fastify.exigir('estoque.gerenciar') };
  const na = (req, fn) => fastify.naBarbearia(req, fn);
  const barbearia = (req) => req.contexto.barbeariaId;
  const usuario = (req) => req.contexto.usuarioId;

  // ---- saldos e movimentos ----
  fastify.get('/estoque', ver, (req) =>
    na(req, async (c) => {
      const { rows } = await c.query(
        `${SELECT_PRODUTO_ESTOQUE} where excluido_em is null`,
      );
      const produtos = rows.sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      );
      return { produtos, comprar: sugestaoDeCompra(produtos) };
    }),
  );

  fastify.get(
    '/estoque/movimentos',
    { ...ver, schema: query({ produtoId: escalar(), limite: escalar() }) },
    (req) =>
      na(req, async (c) => {
        const produtoId = Number(req.query.produtoId) || null;
        const limite = Math.min(
          200,
          Math.max(1, Number(req.query.limite) || 50),
        );
        const { rows } = await c.query(
          `select m.id, m.produto_id as "produtoId", p.nome as "produtoNome", p.unidade,
                  m.tipo, m.quantidade, m.custo_unitario as "custoUnitario", m.motivo,
                  m.comanda_id as "comandaId", m.compra_id as "compraId",
                  m.criado_em as "criadoEm", coalesce(u.nome, '') as "usuarioNome"
             from movimentos_estoque m
             join produtos p on p.id = m.produto_id
             left join usuarios u on u.id = m.usuario_id
            where ($1::bigint is null or m.produto_id = $1)
            order by m.criado_em desc, m.id desc
            limit $2`,
          [produtoId, limite],
        );
        return rows;
      }),
  );

  fastify.post(
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

  fastify.post(
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
        const ids = new Set();
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
        }
        const ajustes = [];
        // Ordem fixa por id: travas sempre na mesma ordem.
        for (const i of [...itens].sort((a, b) => a.produtoId - b.produtoId)) {
          const {
            rows: [p],
          } = await c.query(
            'select saldo from produtos where id = $1 and excluido_em is null for update',
            [i.produtoId],
          );
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
  async function ficha(c, servicoId) {
    const s = await c.query(
      'select 1 from servicos where id = $1 and excluido_em is null',
      [servicoId],
    );
    if (!s.rowCount) throw naoEncontrado('Serviço não encontrado.');
    const { rows } = await c.query(
      `select f.produto_id as "produtoId", p.nome, p.unidade, f.quantidade,
              (p.tipo = 'consumivel' and p.excluido_em is null) as valido
         from fichas_tecnicas f join produtos p on p.id = f.produto_id
        where f.servico_id = $1 order by p.nome`,
      [servicoId],
    );
    return rows;
  }

  fastify.get('/servicos/:id/ficha', ver, (req) =>
    na(req, (c) => ficha(c, Number(req.params.id))),
  );

  fastify.put(
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
        const ids = new Set();
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
          const { rows } = await c.query(
            `select id from produtos
              where id = any($1::bigint[]) and tipo = 'consumivel' and excluido_em is null`,
            [[...ids]],
          );
          if (rows.length !== ids.size)
            throw invalido(
              'A ficha técnica só aceita produtos consumíveis ativos.',
            );
        }
        await c.query('delete from fichas_tecnicas where servico_id = $1', [
          servicoId,
        ]);
        for (const i of itens)
          await c.query(
            `insert into fichas_tecnicas (barbearia_id, servico_id, produto_id, quantidade)
             values ($1, $2, $3, $4)`,
            [barbearia(req), servicoId, i.produtoId, i.quantidade],
          );
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

  fastify.get('/fornecedores', ver, (req) =>
    na(
      req,
      async (c) =>
        (await c.query(`${FORNECEDOR} where excluido_em is null order by nome`))
          .rows,
    ),
  );

  async function fornecedorAtivo(c, id) {
    const {
      rows: [f],
    } = await c.query(`${FORNECEDOR} where id = $1 and excluido_em is null`, [
      Number(id),
    ]);
    if (!f) throw naoEncontrado('Fornecedor não encontrado.');
    return f;
  }

  const salvarFornecedor = (req) =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do fornecedor.');
      const documento = String(d.documento ?? '').replace(/\D/g, '');
      if (!documentoValido(documento)) throw invalido('CPF ou CNPJ inválido.');
      const valores = [
        nome,
        documento || null,
        String(d.telefone ?? '').replace(/\D/g, '') || null,
        String(d.observacoes ?? '').trim(),
      ];
      if (id) {
        await fornecedorAtivo(c, id);
        await c.query(
          `update fornecedores set nome = $2, documento = $3, telefone = $4, observacoes = $5
            where id = $1`,
          [id, ...valores],
        );
        return fornecedorAtivo(c, id);
      }
      const {
        rows: [novo],
      } = await c.query(
        `insert into fornecedores (barbearia_id, nome, documento, telefone, observacoes)
         values ($1, $2, $3, $4, $5) returning id`,
        [barbearia(req), ...valores],
      );
      return fornecedorAtivo(c, novo.id);
    });
  fastify.post('/fornecedores', fornecedor, async (req, reply) => {
    reply.code(201);
    return salvarFornecedor(req);
  });
  fastify.put('/fornecedores/:id', fornecedor, salvarFornecedor);

  fastify.delete('/fornecedores/:id', gerenciar, async (req, reply) => {
    await na(req, async (c) => {
      const f = await fornecedorAtivo(c, req.params.id);
      await c.query(
        'update fornecedores set excluido_em = now() where id = $1',
        [f.id],
      );
    });
    reply.code(204);
  });

  // ---- compras ----
  fastify.get('/compras', ver, (req) =>
    na(
      req,
      async (c) =>
        (
          await c.query(
            `select cp.id, cp.data, cp.fornecedor_id as "fornecedorId", f.nome as "fornecedorNome",
                    cp.total, cp.cancelada_em is not null as cancelada,
                    count(ct.id)::int as parcelas,
                    count(ct.id) filter (where ct.situacao = 'quitada')::int as quitadas
               from compras cp
               join fornecedores f on f.id = cp.fornecedor_id
               left join contas ct on ct.compra_id = cp.id
              group by cp.id, f.nome
              order by cp.data desc, cp.id desc
              limit 500`,
          )
        ).rows,
    ),
  );

  fastify.get('/compras/:id', ver, (req) =>
    na(req, (c) => obterCompra(c, req.params.id)),
  );

  fastify.post(
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

  fastify.post('/compras/:id/cancelar', gerenciar, (req) =>
    na(req, (c) =>
      cancelarCompra(c, barbearia(req), usuario(req), req.params.id),
    ),
  );
}
