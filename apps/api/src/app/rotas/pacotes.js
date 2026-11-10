import { agora } from '../../servicos/agenda.ts';
import { salvarComanda } from '../../servicos/caixa.js';
import {
  assinaturasDoCliente,
  excluirPacote,
  listarPacotes,
  obterAssinatura,
  podeUsar,
  renovarPacote,
  salvarPacote,
  venderPacote,
} from '../../servicos/pacotes.js';
import { TAM, corpo, escalar, inteiro, texto } from '../esquemas.ts';

// Pacotes e assinaturas no banco (planejamento 0034, etapa B). Tudo exige o
// módulo "pacotes" ativo (ADR 0011). Montar exige pacotes.gerenciar; vender e
// renovar, pacotes.vender (o Barbeiro não tem); usar na comanda, caixa.operar.
export default async function (fastify) {
  const modulo = fastify.exigirModulo('pacotes');
  const na = (req, fn) => fastify.naBarbearia(req, fn);
  const barbearia = (req) => req.contexto.barbeariaId;
  const gerenciar = {
    preHandler: [fastify.exigir('pacotes.gerenciar'), modulo],
  };

  const pacote = corpo({
    nome: texto(TAM.nome),
    preco: escalar(),
    tipo: texto(20),
    validadeDias: escalar(),
    itens: {
      type: ['array', 'null'],
      maxItems: 50,
      items: {
        type: 'object',
        properties: { servicoId: inteiro, quantidade: escalar() },
      },
    },
    limites: {
      type: ['object', 'null'],
      properties: {
        intervaloMinimoDias: escalar(),
        maximoPorSemana: escalar(),
      },
    },
  });

  // A venda e a comanda também listam os pacotes.
  fastify.get(
    '/pacotes',
    {
      preHandler: [
        fastify.exigirAlguma(
          'pacotes.gerenciar',
          'pacotes.vender',
          'caixa.operar',
        ),
        modulo,
      ],
    },
    (req) => na(req, (c) => listarPacotes(c)),
  );
  fastify.post(
    '/pacotes',
    { ...gerenciar, schema: pacote },
    async (req, reply) => {
      reply.code(201);
      return na(req, (c) => salvarPacote(c, barbearia(req), req.body ?? {}));
    },
  );
  fastify.put('/pacotes/:id', { ...gerenciar, schema: pacote }, (req) =>
    na(req, (c) =>
      salvarPacote(c, barbearia(req), {
        ...req.body,
        id: Number(req.params.id),
      }),
    ),
  );
  fastify.delete('/pacotes/:id', gerenciar, async (req, reply) => {
    await na(req, (c) => excluirPacote(c, req.params.id, agora().data));
    reply.code(204);
  });

  /** Pacotes do cliente com saldo (cadastro do cliente e comanda). */
  fastify.get(
    '/clientes/:id/assinaturas',
    {
      preHandler: [
        fastify.exigirAlguma('clientes.ver', 'caixa.operar'),
        modulo,
      ],
    },
    (req) =>
      na(req, (c) => assinaturasDoCliente(c, req.params.id, agora().data)),
  );

  // Venda e renovação abrem a comanda no caixa aberto (o caixa monta o item).
  const vender = { preHandler: [fastify.exigir('pacotes.vender'), modulo] };
  const abrirComanda = (c, req) => (dados) =>
    salvarComanda(c, barbearia(req), dados, {
      pacotes: { ativo: true, venda: true },
    });
  const vendido = async (c, { id, comandaId }) => ({
    assinatura: await obterAssinatura(c, id, agora().data),
    comandaId,
  });

  fastify.post(
    '/assinaturas',
    {
      ...vender,
      schema: corpo({
        clienteId: inteiro,
        pacoteId: inteiro,
        barbeiroId: inteiro,
      }),
    },
    async (req, reply) => {
      reply.code(201);
      return na(req, async (c) =>
        vendido(
          c,
          await venderPacote(
            c,
            barbearia(req),
            req.body ?? {},
            abrirComanda(c, req),
          ),
        ),
      );
    },
  );
  fastify.post(
    '/assinaturas/:id/renovar',
    { ...vender, schema: corpo({ barbeiroId: inteiro }) },
    async (req, reply) => {
      reply.code(201);
      return na(req, async (c) =>
        vendido(
          c,
          await renovarPacote(
            c,
            barbearia(req),
            req.params.id,
            req.body ?? {},
            abrirComanda(c, req),
          ),
        ),
      );
    },
  );

  /** Pré-checagem da comanda: pode usar este pacote neste serviço hoje? */
  fastify.post(
    '/assinaturas/:id/pode-usar',
    {
      preHandler: [fastify.exigir('caixa.operar'), modulo],
      schema: corpo({
        servicoId: inteiro,
        jaNaComanda: { type: ['array', 'null'], maxItems: 200, items: inteiro },
      }),
    },
    (req) =>
      na(req, (c) =>
        podeUsar(
          c,
          {
            assinaturaId: req.params.id,
            servicoId: req.body?.servicoId,
            jaNaComanda: req.body?.jaNaComanda ?? [],
          },
          agora().data,
        ),
      ),
  );
}
