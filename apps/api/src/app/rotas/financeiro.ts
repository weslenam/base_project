import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Conexao } from '../../infra/banco.ts';
import { agora } from '../../servicos/agenda.ts';
import { somarDias } from '@barbertime/dominio';
import {
  baixarConta,
  cancelarConta,
  criarConta,
  editarConta,
  encerrarRecorrencia,
  estornarBaixa,
  excluirCategoria,
  listarCategorias,
  listarContas,
  listarRecorrencias,
  obterConta,
  previsao,
  salvarCategoria,
  salvarRecorrencia,
} from '../../servicos/financeiro.ts';
import type {
  DadosDaBaixa,
  DadosDaCategoria,
  DadosDaConta,
  DadosDaRecorrencia,
  FiltrosDeContas,
} from '../../servicos/financeiro.ts';
import {
  campoData,
  corpo,
  escalar,
  inteiro,
  logico,
  query,
  texto,
} from '../esquemas.ts';
import { invalido } from '../../infra/erros.ts';

type ComId = { Params: { id: string } };

// Financeiro (planejamento 0027, parte 2, fatia 2A): contas a pagar e a
// receber e categorias. financeiro.gerenciar só vale com o módulo "financeiro"
// ativo (permissoesEfetivas): sem ele, todas estas rotas dão 403. Só Gerente
// e Dono (decisão 2).
export default async function (fastify: FastifyInstance) {
  const gerenciar = { preHandler: fastify.exigir('financeiro.gerenciar') };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);
  const barbearia = (req: FastifyRequest) => req.contexto.barbeariaId;
  const hoje = () => agora().data;

  // ---- categorias ----
  const categoria = {
    ...gerenciar,
    schema: corpo({ nome: texto(80), tipo: texto(10), ativa: logico }),
  };
  fastify.get('/financeiro/categorias', gerenciar, (req) =>
    na(req, (c) => listarCategorias(c, barbearia(req))),
  );
  fastify.post<{ Body: DadosDaCategoria | null }>(
    '/financeiro/categorias',
    categoria,
    async (req, reply) => {
      reply.code(201);
      return na(req, (c) => salvarCategoria(c, barbearia(req), req.body ?? {}));
    },
  );
  fastify.put<ComId & { Body: DadosDaCategoria | null }>(
    '/financeiro/categorias/:id',
    categoria,
    (req) =>
      na(req, (c) =>
        salvarCategoria(c, barbearia(req), {
          ...req.body,
          id: Number(req.params.id),
        }),
      ),
  );
  fastify.delete<ComId>(
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
  fastify.get<{ Querystring: FiltrosDeContas }>(
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
  fastify.get<ComId>('/financeiro/contas/:id', gerenciar, (req) =>
    na(req, (c) => obterConta(c, req.params.id, hoje())),
  );
  fastify.post<{ Body: DadosDaConta | null }>(
    '/financeiro/contas',
    conta,
    async (req, reply) => {
      reply.code(201);
      return na(req, (c) =>
        criarConta(c, barbearia(req), req.body ?? {}, hoje()),
      );
    },
  );
  fastify.put<ComId & { Body: DadosDaConta | null }>(
    '/financeiro/contas/:id',
    conta,
    (req) =>
      na(req, (c) => editarConta(c, req.params.id, req.body ?? {}, hoje())),
  );
  fastify.post<ComId>('/financeiro/contas/:id/cancelar', gerenciar, (req) =>
    na(req, (c) => cancelarConta(c, req.params.id, hoje())),
  );
  fastify.post<ComId & { Body: DadosDaBaixa | null }>(
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
  fastify.post<ComId>('/financeiro/contas/:id/estornar', gerenciar, (req) =>
    na(req, (c) => estornarBaixa(c, req.params.id, hoje())),
  );

  // ---- recorrências ----
  const recorrencia = {
    ...gerenciar,
    schema: corpo({
      tipo: texto(10),
      descricao: texto(200),
      categoriaId: inteiro,
      valor: escalar(),
      diaDoMes: inteiro,
      fornecedorId: inteiro,
    }),
  };
  fastify.get('/financeiro/recorrencias', gerenciar, (req) =>
    na(req, (c) => listarRecorrencias(c, barbearia(req), hoje())),
  );
  fastify.post<{ Body: DadosDaRecorrencia | null }>(
    '/financeiro/recorrencias',
    recorrencia,
    async (req, reply) => {
      reply.code(201);
      return na(req, (c) =>
        salvarRecorrencia(c, barbearia(req), req.body ?? {}, hoje()),
      );
    },
  );
  fastify.put<ComId & { Body: DadosDaRecorrencia | null }>(
    '/financeiro/recorrencias/:id',
    recorrencia,
    (req) =>
      na(req, (c) =>
        salvarRecorrencia(
          c,
          barbearia(req),
          { ...req.body, id: Number(req.params.id) },
          hoje(),
        ),
      ),
  );
  fastify.post<ComId>('/financeiro/recorrencias/:id/encerrar', gerenciar, (req) =>
    na(req, (c) => encerrarRecorrencia(c, barbearia(req), req.params.id, hoje())),
  );

  // ---- previsão ----
  fastify.get<{ Querystring: { inicio?: string; fim?: string } }>(
    '/financeiro/previsao',
    {
      ...gerenciar,
      schema: query({ inicio: { ...campoData, type: ['string', 'null'] }, fim: { ...campoData, type: ['string', 'null'] } }),
    },
    (req) =>
      na(req, (c) => {
        const h = hoje();
        const inicio = req.query.inicio || h;
        const fim = req.query.fim || somarDias(inicio, 30);
        if (inicio > fim) throw invalido('O início não pode ser depois do fim.');
        return previsao(c, barbearia(req), inicio, fim, h);
      }),
  );
}
