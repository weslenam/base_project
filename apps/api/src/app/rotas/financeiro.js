import { agora } from '../../servicos/agenda.js';
import {
  baixarConta,
  cancelarConta,
  criarConta,
  editarConta,
  estornarBaixa,
  excluirCategoria,
  listarCategorias,
  listarContas,
  obterConta,
  salvarCategoria,
} from '../../servicos/financeiro.js';
import {
  campoData,
  corpo,
  escalar,
  inteiro,
  logico,
  query,
  texto,
} from '../esquemas.js';

// Financeiro (planejamento 0027, parte 2, fatia 2A): contas a pagar e a
// receber e categorias. financeiro.gerenciar só vale com o módulo "financeiro"
// ativo (permissoesEfetivas): sem ele, todas estas rotas dão 403. Só Gerente
// e Dono (decisão 2).
export default async function (fastify) {
  const gerenciar = { preHandler: fastify.exigir('financeiro.gerenciar') };
  const na = (req, fn) => fastify.naBarbearia(req, fn);
  const barbearia = (req) => req.contexto.barbeariaId;
  const hoje = () => agora().data;

  // ---- categorias ----
  const categoria = {
    ...gerenciar,
    schema: corpo({ nome: texto(80), tipo: texto(10), ativa: logico }),
  };
  fastify.get('/financeiro/categorias', gerenciar, (req) =>
    na(req, (c) => listarCategorias(c, barbearia(req))),
  );
  fastify.post('/financeiro/categorias', categoria, async (req, reply) => {
    reply.code(201);
    return na(req, (c) => salvarCategoria(c, barbearia(req), req.body ?? {}));
  });
  fastify.put('/financeiro/categorias/:id', categoria, (req) =>
    na(req, (c) =>
      salvarCategoria(c, barbearia(req), {
        ...req.body,
        id: Number(req.params.id),
      }),
    ),
  );
  fastify.delete(
    '/financeiro/categorias/:id',
    gerenciar,
    async (req, reply) => {
      await na(req, (c) => excluirCategoria(c, req.params.id));
      reply.code(204);
    },
  );

  // ---- contas ----
  const conta = {
    ...gerenciar,
    schema: corpo({
      tipo: texto(10),
      descricao: texto(200),
      categoriaId: inteiro,
      valor: escalar(),
      vencimento: campoData,
      fornecedorId: inteiro,
      clienteId: inteiro,
    }),
  };
  fastify.get(
    '/financeiro/contas',
    {
      ...gerenciar,
      schema: query({
        tipo: texto(10),
        situacao: texto(10),
        de: campoData,
        ate: campoData,
      }),
    },
    (req) => na(req, (c) => listarContas(c, req.query ?? {}, hoje())),
  );
  fastify.get('/financeiro/contas/:id', gerenciar, (req) =>
    na(req, (c) => obterConta(c, req.params.id, hoje())),
  );
  fastify.post('/financeiro/contas', conta, async (req, reply) => {
    reply.code(201);
    return na(req, (c) =>
      criarConta(c, barbearia(req), req.body ?? {}, hoje()),
    );
  });
  fastify.put('/financeiro/contas/:id', conta, (req) =>
    na(req, (c) => editarConta(c, req.params.id, req.body ?? {}, hoje())),
  );
  fastify.post('/financeiro/contas/:id/cancelar', gerenciar, (req) =>
    na(req, (c) => cancelarConta(c, req.params.id, hoje())),
  );
  fastify.post(
    '/financeiro/contas/:id/baixar',
    {
      ...gerenciar,
      schema: corpo({
        data: campoData,
        valorPago: escalar(),
        forma: texto(20),
      }),
    },
    (req) =>
      na(req, (c) =>
        baixarConta(c, barbearia(req), req.params.id, req.body ?? {}, {
          hoje: hoje(),
          usuarioId: req.contexto.usuarioId,
        }),
      ),
  );
  fastify.post('/financeiro/contas/:id/estornar', gerenciar, (req) =>
    na(req, (c) => estornarBaixa(c, req.params.id, hoje())),
  );
}
