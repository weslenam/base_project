import { timingSafeEqual } from 'node:crypto';
import {
  horariosLivres,
  janelaDoAgendamentoOnline,
  mesclarConfigBarbearia,
  naGrade,
  sobrepoe,
} from '@barbertime/dominio';
import type {
  ConfigBarbearia,
  ConfigBarbeariaGravada,
} from '@barbertime/dominio';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import { invalido, naoEncontrado } from '../../infra/erros.ts';
import {
  agora,
  buscarBarbeiro,
  buscarServico,
  criarAgendamento,
  ocupadosDoDia,
} from '../../servicos/agenda.ts';
import { chaves } from '../../seguranca/limites.ts';
import {
  campoData,
  campoHora,
  clienteResumido,
  corpo,
  inteiro,
  query,
  TAM,
  texto,
} from '../esquemas.ts';
import type { AgendamentoPublico, PaginaPublica } from '@barbertime/contratos';

/**
 * Página pública de agendamento (planejamento 0019, ADR 0013). Sem sessão.
 * Inexistente, desativada, sem o módulo ou com código errado: a MESMA resposta
 * 404, para não revelar que a barbearia existe.
 */
const NAO_ENCONTRADA = 'Barbearia não encontrada.';

interface LinhaDaBarbeariaPublica {
  id: number;
  nome: string;
  slug: string;
  configuracoes: ConfigBarbeariaGravada;
  token_publico: string;
}

type ComSlug = { Params: { slug: string } };
type Codigo = { c?: string | null };

const mesmoToken = (a: unknown, b: unknown): boolean => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function (
  fastify: FastifyInstance,
  { liberada = false }: { liberada?: boolean } = {},
) {
  /**
   * Barbearia publicada pelo slug (+ código do link, se o modo pedir).
   * `barbearias` é global: a busca pelo slug roda no pool (driver pg).
   */
  async function publicada(req: { params: { slug: string }; query: Codigo }) {
    // Trava geral: enquanto bloqueada, nenhuma página pública abre.
    if (!liberada) throw naoEncontrado(NAO_ENCONTRADA);
    const {
      rows: [b],
    } = await fastify.db.query<LinhaDaBarbeariaPublica>(
      'select id, nome, slug, configuracoes, token_publico from barbearias where slug = $1 and suspensa_em is null',
      [String(req.params.slug)],
    );
    if (!b) throw naoEncontrado(NAO_ENCONTRADA);
    const config = mesclarConfigBarbearia(b.configuracoes);
    const modo = config.paginaPublica.modo;
    if (modo === 'desativada') throw naoEncontrado(NAO_ENCONTRADA);
    if (modo === 'com_link' && !mesmoToken(req.query.c, b.token_publico))
      throw naoEncontrado(NAO_ENCONTRADA);
    const ativo = await fastify.comBarbearia(b.id, (c) =>
      c.db
        .selectFrom('barbeariaModulos')
        .select(sql`1`.as('ativo'))
        .where('modulo', '=', 'agendamento_online')
        .where('estado', '=', 'ativo')
        .executeTakeFirst(),
    );
    if (!ativo) throw naoEncontrado(NAO_ENCONTRADA);
    return { id: b.id, nome: b.nome, slug: b.slug, config };
  }

  const janela = (
    config: ConfigBarbearia,
    barbeiro: { inicio: string; fim: string },
    data: string,
  ) => janelaDoAgendamentoOnline({ config, barbeiro, data, agora: agora() });

  // Limites (ADR 0014): a página é aberta, então tudo tem teto por IP; o
  // reconhecimento e o agendamento, que tocam dados de clientes, têm tetos
  // também por barbearia e por telefone (varredura distribuída).
  const codigo = { c: texto(TAM.codigo) };
  const porIp = fastify.limitar('publicoPorIp', chaves.ip);
  const pagina = { schema: query(codigo), preHandler: porIp };
  const horarios = {
    schema: query({
      ...codigo,
      data: campoData,
      barbeiroId: inteiro,
      servicoId: inteiro,
    }),
    preHandler: porIp,
  };
  const reconhecer = {
    schema: query({ ...codigo, telefone: texto(TAM.telefone) }),
    preHandler: [
      fastify.limitar('reconhecerPorIp', chaves.ip),
      fastify.limitar('reconhecerPorBarbearia', chaves.slug),
    ],
  };
  const agendar = {
    schema: {
      ...query(codigo),
      ...corpo({
        data: campoData,
        inicio: campoHora,
        barbeiroId: inteiro,
        servicoId: inteiro,
        cliente: clienteResumido,
      }),
    },
    preHandler: [
      fastify.limitar('agendarPorIp', chaves.ip),
      fastify.limitar('agendarPorTelefone', chaves.telefoneDoCliente),
    ],
  };

  /** Tudo que a página precisa para começar. */
  fastify.get<ComSlug & { Querystring: Codigo }>(
    '/publico/:slug',
    pagina,
    async (req): Promise<PaginaPublica> => {
      const b = await publicada(req);
      return fastify.comBarbearia(b.id, async (c) => {
        const servicos = await c.db
          .selectFrom('servicos')
          .select(['id', 'nome', 'duracao', 'preco'])
          .where('excluidoEm', 'is', null)
          .orderBy('nome')
          .execute();
        const barbeiros = await c.db
          .selectFrom('barbeiros')
          .select(['id', 'nome', 'inicio', 'fim'])
          .where('excluidoEm', 'is', null)
          .orderBy('id')
          .execute();
        return {
          barbearia: {
            nome: b.nome,
            slug: b.slug,
            contato: b.config.contato,
            funcionamento: b.config.funcionamento,
            agendamento: b.config.agendamento,
          },
          servicos,
          barbeiros,
          hoje: agora().data,
        };
      });
    },
  );

  fastify.get<
    ComSlug & {
      Querystring: Codigo & {
        data?: string | null;
        barbeiroId?: number | null;
        servicoId?: number | null;
      };
    }
  >('/publico/:slug/horarios', horarios, async (req) => {
    const b = await publicada(req);
    const { data, barbeiroId, servicoId } = req.query;
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data))
      throw invalido('Escolha o dia.');
    return fastify.comBarbearia(b.id, async (c) => {
      const barbeiro = await buscarBarbeiro(c, Number(barbeiroId) || 0);
      const servico = await buscarServico(c, Number(servicoId) || 0);
      const j = janela(b.config, barbeiro, data);
      if (!j) return [];
      return horariosLivres({
        expediente: j,
        duracao: servico.duracao,
        ocupados: await ocupadosDoDia(c, data, barbeiro.id),
        aPartirDe: j.aPartirDe,
      });
    });
  });

  /**
   * Só diz se o telefone já é cliente, com o PRIMEIRO nome (LGPD). Com teto por
   * IP e por barbearia, varrer números deixa de ser viável; estourado, o front
   * segue como "cliente novo" (ADR 0014).
   */
  fastify.get<ComSlug & { Querystring: Codigo & { telefone?: string | null } }>(
    '/publico/:slug/cliente',
    reconhecer,
    async (req) => {
      const b = await publicada(req);
      const telefone = String(req.query.telefone ?? '').replace(/\D/g, '');
      if (!/^\d{10,11}$/.test(telefone)) return null;
      const c = await fastify.comBarbearia(b.id, (cx) =>
        cx.db
          .selectFrom('clientes')
          .select('nome')
          .where('telefone', '=', telefone)
          .executeTakeFirst(),
      );
      return c ? { primeiroNome: c.nome.trim().split(/\s+/)[0] } : null;
    },
  );

  fastify.post<
    ComSlug & {
      Querystring: Codigo;
      Body:
        | {
            data?: string | null;
            inicio?: string | null;
            barbeiroId?: number | null;
            servicoId?: number | null;
            cliente?: { nome?: string | null; telefone?: string | null } | null;
          }
        | undefined;
    }
  >(
    '/publico/:slug/agendamentos',
    agendar,
    async (req, reply): Promise<AgendamentoPublico> => {
      const b = await publicada(req);
      const { data, inicio, barbeiroId, servicoId, cliente } = req.body ?? {};
      const r = await fastify.comBarbearia(b.id, (c) =>
        criarAgendamento(
          c,
          b.id,
          {
            data,
            inicio,
            barbeiroId: Number(barbeiroId),
            servicoId: Number(servicoId),
            cliente: { nome: cliente?.nome, telefone: cliente?.telefone },
            canal: 'publico',
          },
          {
            validarJanela: ({ barbeiro, data: dia, inicio: ini, fim }) => {
              const j = janela(b.config, barbeiro, dia);
              const dentro =
                j &&
                ini >= (j.aPartirDe ?? j.inicio) &&
                ini >= j.inicio &&
                fim <= j.fim;
              // Só os horários que a página oferece (grade a partir do início).
              if (
                !dentro ||
                !sobrepoe({ inicio: ini, fim }, j) ||
                !naGrade(ini, j.inicio)
              )
                throw invalido(
                  'Esse horário não está disponível para agendamento online. Escolha outro.',
                );
            },
          },
        ),
      );
      reply.code(201);
      // Só o necessário para a confirmação.
      return {
        id: r.id,
        data: r.data,
        inicio: r.inicio,
        fim: r.fim,
        servicoNome: r.servicoNome,
        barbeiroNome: r.barbeiroNome,
        // O nome digitado, nunca o do cadastro: agendar não pode virar um atalho
        // para o reconhecimento por telefone, que tem limites próprios mais
        // apertados (o front usa o nome da saudação).
        primeiroNome:
          String(cliente?.nome ?? '')
            .trim()
            .split(/\s+/)[0] || null,
      };
    },
  );
}
