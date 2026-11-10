import { sql } from 'kysely';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { conflito, invalido, naoEncontrado } from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';
import { SELECT_ATENDIMENTO, agora, comEstado } from '../../servicos/agenda.ts';
import type { LinhaDeAtendimento } from '../../servicos/agenda.ts';
import { TAM, corpo, query, texto } from '../esquemas.ts';

// Clientes da barbearia (planejamento 0019).

/** Cliente com o resumo de atendimentos (`GET /clientes` e `/clientes/:id`). */
export interface ClienteComResumo {
  id: number;
  nome: string;
  telefone: string | null;
  cpf: string | null;
  observacoes: string;
  /** Atendimentos finalizados ou pagos. */
  atendimentos: number;
  faltas: number;
  /** Data (AAAA-MM-DD) do último atendimento finalizado ou pago. */
  ultimaVisita: string | null;
}

interface CorpoDoCliente {
  nome?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  observacoes?: string | null;
}

type ComId = { Params: { id: string } };

const formatarTelefone = (t: string): string =>
  t.length === 11
    ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`
    : `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;

const ATENDIDO = ['finalizado', 'pago'];

/** Cliente com o resumo de atendimentos (contagens e última visita). */
const selecionarCliente = (c: Conexao) =>
  c.db.selectFrom('clientes as c').select((eb) => [
    'c.id',
    'c.nome',
    'c.telefone',
    'c.cpf',
    'c.observacoes',
    eb
      .selectFrom('atendimentos as a')
      .select(sql<number>`count(*)::int`.as('n'))
      .whereRef('a.clienteId', '=', 'c.id')
      .where('a.estado', 'in', ATENDIDO)
      .$asScalar()
      .$notNull()
      .as('atendimentos'),
    eb
      .selectFrom('atendimentos as a')
      .select(sql<number>`count(*)::int`.as('n'))
      .whereRef('a.clienteId', '=', 'c.id')
      .where('a.estado', '=', 'no_show')
      .$asScalar()
      .$notNull()
      .as('faltas'),
    eb
      .selectFrom('atendimentos as a')
      .select((sub) => sub.fn.max('a.data').as('d'))
      .whereRef('a.clienteId', '=', 'c.id')
      .where('a.estado', 'in', ATENDIDO)
      .$asScalar()
      .as('ultimaVisita'),
  ]);

export default async function (fastify: FastifyInstance) {
  const ver = {
    preHandler: fastify.exigirAlguma(
      'clientes.ver',
      'agenda.gerenciar',
      'caixa.operar',
    ),
  };
  const editar = {
    preHandler: fastify.exigirAlguma(
      'clientes.editar',
      'agenda.gerenciar',
      'caixa.operar',
    ),
  };
  const excluir = { preHandler: fastify.exigir('clientes.excluir') };
  const cliente = {
    ...editar,
    schema: corpo({
      nome: texto(TAM.nome),
      telefone: texto(TAM.telefone),
      cpf: texto(TAM.cpf),
      observacoes: texto(TAM.observacao),
    }),
  };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);

  async function obter(
    c: Conexao,
    id: number | string,
  ): Promise<ClienteComResumo> {
    const cliente = await selecionarCliente(c)
      .where('c.id', '=', Number(id))
      .where('c.excluidoEm', 'is', null)
      .executeTakeFirst();
    if (!cliente) throw naoEncontrado('Cliente não encontrado.');
    return cliente;
  }

  /** busca: parte do nome ou dos dígitos do telefone. */
  fastify.get<{ Querystring: { busca?: string | null } }>(
    '/clientes',
    { ...ver, schema: query({ busca: texto(TAM.nome) }) },
    (req): Promise<ClienteComResumo[]> =>
      na(req, async (c) => {
        const busca = String(req.query.busca ?? '').trim();
        const digitos = busca.replace(/\D/g, '');
        const rows = await selecionarCliente(c)
          .where('c.excluidoEm', 'is', null)
          // Sem busca, todos; com busca, parte do nome (sem caixa) ou, se ela
          // tiver dígitos, parte do telefone. O texto vai como parâmetro.
          .$if(busca !== '', (qb) =>
            qb.where((eb) =>
              eb.or([
                eb('c.nome', 'ilike', `%${busca}%`),
                ...(digitos !== ''
                  ? [eb('c.telefone', 'like', `%${digitos}%`)]
                  : []),
              ]),
            ),
          )
          .limit(500)
          .execute();
        return rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      }),
  );

  fastify.get<ComId>('/clientes/:id', ver, (req) =>
    na(req, (c) => obter(c, req.params.id)),
  );

  fastify.get<ComId>('/clientes/:id/historico', ver, (req) =>
    na(req, async (c) => {
      await obter(c, req.params.id);
      // SELECT_ATENDIMENTO é o SQL compartilhado da agenda (servicos/agenda.ts),
      // com parâmetro; segue no driver até a agenda virar Kysely.
      return (
        await c.query<LinhaDeAtendimento>(
          `${SELECT_ATENDIMENTO} where a.cliente_id = $1 order by a.data desc, a.inicio desc nulls last`,
          [Number(req.params.id)],
        )
      ).rows.map(comEstado);
    }),
  );

  const salvar = (
    req: FastifyRequest<{
      Params: { id?: string };
      Body: CorpoDoCliente | undefined;
    }>,
  ): Promise<ClienteComResumo> =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      const telefone = String(d.telefone ?? '').replace(/\D/g, '');
      if (!nome) throw invalido('Informe o nome do cliente.');
      if (!telefone) throw invalido('Informe o telefone do cliente.');
      if (!/^\d{10,11}$/.test(telefone))
        throw invalido('Telefone inválido: use DDD + número.');
      const dono = await c.db
        .selectFrom('clientes')
        .select('nome')
        .where('telefone', '=', telefone)
        .where('id', '<>', id ?? 0)
        .executeTakeFirst();
      if (dono)
        throw conflito(
          `O telefone ${formatarTelefone(telefone)} já está no cadastro de ${dono.nome}.`,
        );
      const valores = {
        nome,
        telefone,
        cpf: String(d.cpf ?? '').replace(/\D/g, '') || null,
        observacoes: String(d.observacoes ?? '').trim(),
      };
      if (id) {
        await obter(c, id);
        await c.db
          .updateTable('clientes')
          .set(valores)
          .where('id', '=', id)
          .execute();
        return obter(c, id);
      }
      const novo = await c.db
        .insertInto('clientes')
        .values({ barbeariaId: req.contexto.barbeariaId, ...valores })
        .returning('id')
        .executeTakeFirstOrThrow();
      return obter(c, novo.id);
    });
  fastify.post<{ Params: { id?: string }; Body: CorpoDoCliente | undefined }>(
    '/clientes',
    cliente,
    async (req, reply) => {
      reply.code(201);
      return salvar(req);
    },
  );
  fastify.put<ComId & { Body: CorpoDoCliente | undefined }>(
    '/clientes/:id',
    cliente,
    salvar,
  );

  fastify.delete<ComId>('/clientes/:id', excluir, async (req, reply) => {
    await na(req, async (c) => {
      const cliente = await obter(c, req.params.id);
      const { n } = await c.db
        .selectFrom('atendimentos')
        .select(sql<number>`count(*)::int`.as('n'))
        .where('clienteId', '=', cliente.id)
        .where('data', '>=', agora().data)
        .where('estado', 'in', [
          'agendado',
          'chegou',
          'na_fila',
          'em_atendimento',
        ])
        .executeTakeFirstOrThrow();
      if (n)
        throw conflito(
          `Não é possível excluir "${cliente.nome}": há ${n} agendamento${n > 1 ? 's' : ''} futuro${n > 1 ? 's' : ''}. Cancele ou remarque antes.`,
        );
      // Anonimiza (LGPD) e mantém atendimentos e comandas no histórico.
      await c.db
        .updateTable('clientes')
        .set({
          nome: 'Cliente removido',
          telefone: null,
          cpf: null,
          observacoes: '',
          excluidoEm: sql<Date>`now()`,
        })
        .where('id', '=', cliente.id)
        .execute();
    });
    reply.code(204);
  });
}
