import {
  fimDe,
  mesclarConfigBarbearia,
  ordenarFila,
  paraHora,
  paraMinutos,
  podeAgirNoBalcao,
  podeTransitar,
  situacaoDosBarbeiros,
  sugerirEncaixe,
} from '@barbertime/dominio';
import type {
  AtendimentoBalcao,
  ConfigBarbearia,
  ConfigBarbeariaGravada,
} from '@barbertime/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import type { RawBuilder } from 'kysely';
import { conflito, invalido, proibido } from '../../infra/erros.ts';
import type { Conexao } from '../../infra/banco.ts';
import {
  agora,
  buscarBarbeiro,
  buscarServico,
  clientePorTelefone,
} from '../../servicos/agenda.ts';
import {
  atendimentosOnde,
  obterAtendimento,
} from '../../servicos/atendimentos.ts';
import type {
  AtendimentoNaAgenda,
  EncaixeDoBalcao,
  PainelDoBalcao,
} from '@barbertime/contratos';
import {
  cancelarComanda,
  comandaDoAtendimento,
  exigirCaixaAberto,
  caixaDoDia,
} from '../../servicos/caixa.ts';
import { TAM, corpo, inteiro, logico, query, texto } from '../esquemas.ts';

// Balcão (planejamento 0020, fase 1; especificação docs/atendimento/balcao.md).
// Agenda e fila são visões da mesma tabela `atendimentos`.

const PROXIMAS_HORAS = 3;

type ConfigDoBalcao = ConfigBarbearia['balcao'];
type ComId = { Params: { id: string } };

/**
 * Atendimento do dia como o domínio do balcão o enxerga: `estado` é o status
 * do atendimento (agendado, chegou...), não o da agenda.
 */
type NoBalcao = AtendimentoNaAgenda & AtendimentoBalcao;

/**
 * A situação dos barbeiros e a fila devolvem os mesmos objetos que receberam
 * (atendimentos do dia): este é o tipo deles, com nome do cliente, serviço e
 * comanda.
 */
const doDia = (a: AtendimentoBalcao) => a as NoBalcao;

export default async function (fastify: FastifyInstance) {
  const operar = {
    preHandler: fastify.exigirAlguma('agenda.gerenciar', 'caixa.operar'),
  };
  const na = <T>(req: FastifyRequest, fn: (c: Conexao) => Promise<T>) =>
    fastify.naBarbearia(req, fn);

  // Quem só opera o caixa (Barbeiro) age no que é seu (planejamento 0036).
  const MOTIVOS: Record<string, string> = {
    iniciar:
      'Você só pode iniciar, com você mesmo, os seus atendimentos ou avulsos sem barbeiro.',
    finalizar: 'Você só pode finalizar os seus atendimentos.',
    desistir:
      'Você só pode marcar desistência nos seus atendimentos ou nos que você lançou.',
    no_show:
      'Você só pode marcar falta nos seus atendimentos ou nos que você lançou.',
    pausa: 'Você só pode pausar a sua própria agenda.',
  };
  function exigirNoBalcao(
    req: FastifyRequest,
    acao: string,
    alvo: Parameters<typeof podeAgirNoBalcao>[2],
  ): void {
    if (!podeAgirNoBalcao(req.contexto, acao, alvo))
      throw proibido(MOTIVOS[acao] ?? 'Sem permissão para essa ação.');
  }

  async function configDoBalcao(req: FastifyRequest): Promise<ConfigDoBalcao> {
    // `barbearias` é tabela global (sem RLS): lida pelo pool, fora da
    // transação da barbearia, sempre pelo id do contexto da requisição.
    const { rows } = await fastify.db.query<{
      configuracoes: ConfigBarbeariaGravada | null;
    }>('select configuracoes from barbearias where id = $1', [
      req.contexto.barbeariaId,
    ]);
    // Sem configuração gravada vale o padrão (o domínio trata null e vazio).
    return mesclarConfigBarbearia(rows[0]?.configuracoes ?? undefined).balcao;
  }

  /** Tudo do dia que o balcão precisa: barbeiros, fila, próximos e a cobrar. */
  async function estadoDoDia(c: Conexao, config: ConfigDoBalcao) {
    const { data, hora } = agora();
    const barbeiros = await c.db
      .selectFrom('barbeiros')
      .select(['id', 'nome', 'inicio', 'fim', 'emPausa', 'usuarioId'])
      .where('excluidoEm', 'is', null)
      .orderBy('id')
      .execute();
    const atendimentos = await atendimentosOnde(
      c,
      sql`where a.data = ${data} and a.estado not in ('cancelado', 'desistiu', 'no_show')
        order by a.inicio nulls last, a.chegou_em`,
    );
    const situacao = situacaoDosBarbeiros({
      barbeiros,
      atendimentos: atendimentos.map((a) => ({ ...a, estado: a.status })),
      agora: hora,
      tolerancia: config.toleranciaMinutos,
    });
    const fila = ordenarFila(
      atendimentos.map((a) => ({ ...a, estado: a.status })),
      config.toleranciaMinutos,
    );
    return { data, hora, barbeiros, atendimentos, situacao, fila };
  }

  fastify.get('/balcao', operar, async (req): Promise<PainelDoBalcao> => {
    const config = await configDoBalcao(req);
    return na(req, async (c) => {
      const d = await estadoDoDia(c, config);
      const limite = paraMinutos(d.hora) + PROXIMAS_HORAS * 60;
      // O agendado sempre tem início (só o avulso nasce sem).
      const inicioDe = (a: AtendimentoNaAgenda) => paraMinutos(a.inicio ?? '');
      const proximos = d.atendimentos.filter(
        (a) =>
          a.status === 'agendado' &&
          inicioDe(a) + config.toleranciaMinutos >= paraMinutos(d.hora) &&
          inicioDe(a) <= limite,
      );
      // Agendados que passaram da tolerância sem chegar: o balcão marca falta.
      const atrasados = d.atendimentos.filter(
        (a) =>
          a.status === 'agendado' &&
          inicioDe(a) + config.toleranciaMinutos < paraMinutos(d.hora),
      );
      // Previsão de espera de cada um da fila (simulando os que estão à frente).
      const fila = d.fila.map((item, i) => {
        const r = sugerirEncaixe({
          situacao: d.situacao,
          fila: d.fila.slice(0, i),
          duracao: item.duracao ?? 30,
          agora: d.hora,
          folga: config.folgaMinutos,
        });
        const prev = item.barbeiroId
          ? r.porBarbeiro.find((p) => p.barbeiroId === item.barbeiroId)
          : r.primeiroLivre;
        return {
          ...item,
          estado: item.status,
          // Comparação de texto (HH:MM) como antes; sem um dos dois, dá falso.
          atrasado:
            item.status === 'chegou' &&
            item.chegouAs != null &&
            item.inicio != null &&
            item.chegouAs > item.inicio,
          esperaMin: prev?.esperaMin ?? null,
          barbeiroSugeridoId: prev?.barbeiroId ?? item.barbeiroId ?? null,
          podeAgora: Boolean(prev?.podeAgora),
        };
      });
      const caixa = await caixaDoDia(c);
      // Em `sql`: o join usa subconsulta e o `@>` do jsonb (a comanda tem um
      // item deste serviço). Só a data vai como parâmetro.
      const { rows: servicos } = await sql<{
        id: number;
        nome: string;
        duracao: number;
        preco: number;
        vendas: number;
      }>`select s.id, s.nome, s.duracao, s.preco, count(cm.id)::int as vendas
           from servicos s
           left join comandas cm on cm.estado = 'paga'
             -- Só os últimos 90 dias: a contagem não cresce com o histórico.
             and cm.caixa_id in (select id from caixas where data >= ${d.data}::date - 90)
             and cm.itens @> jsonb_build_array(jsonb_build_object('tipo', 'servico', 'refId', s.id))
          where s.excluido_em is null
          group by s.id order by vendas desc, s.nome`.execute(c.db);
      return {
        data: d.data,
        agora: d.hora,
        config,
        caixaAberto: Boolean(caixa?.aberto),
        barbeiros: d.situacao.map((s) => {
          const atual = s.atual && doDia(s.atual);
          const proximo = s.reservados[0] && doDia(s.reservados[0]);
          return {
            ...s,
            // Conta ligada ao barbeiro: a tela mostra a quem só opera o caixa
            // (Barbeiro) apenas as ações sobre si mesmo (planejamento 0036).
            usuarioId:
              d.barbeiros.find((b) => b.id === s.id)?.usuarioId ?? null,
            atual: atual && {
              id: atual.id,
              clienteNome: atual.clienteNome,
              servicoNome: atual.servicoNome,
              comandaId: atual.comandaId,
            },
            proximo: proximo
              ? {
                  id: proximo.id,
                  inicio: proximo.inicio,
                  clienteNome: proximo.clienteNome,
                }
              : null,
            reservados: undefined,
          };
        }),
        fila,
        proximos,
        atrasados,
        aCobrar: d.atendimentos.filter(
          (a) => a.status === 'finalizado' && a.comandaEstado === 'aberta',
        ),
        servicos,
      };
    });
  });

  /** Previsão para um avulso novo: quem pode agora e a espera com cada barbeiro. */
  fastify.get<{ Querystring: { servicoId?: number | null } }>(
    '/balcao/encaixe',
    { ...operar, schema: query({ servicoId: inteiro }) },
    async (req): Promise<EncaixeDoBalcao> => {
      const config = await configDoBalcao(req);
      return na(req, async (c) => {
        // buscarServico faz Number(id): o mesmo valor de antes da conversão.
        const servico = await buscarServico(c, Number(req.query.servicoId));
        const d = await estadoDoDia(c, config);
        const r = sugerirEncaixe({
          situacao: d.situacao,
          fila: d.fila,
          duracao: servico.duracao,
          agora: d.hora,
          folga: config.folgaMinutos,
        });
        const nome: Record<number, string> = Object.fromEntries(
          d.barbeiros.map((b) => [b.id, b.nome]),
        );
        return {
          porBarbeiro: r.porBarbeiro.map((p) => ({
            ...p,
            barbeiroNome: nome[p.barbeiroId],
            // porBarbeiro sai da própria situação: o barbeiro sempre está lá.
            estado: d.situacao.find((s) => s.id === p.barbeiroId)?.estado,
          })),
          primeiroLivre: r.primeiroLivre && {
            ...r.primeiroLivre,
            barbeiroNome: nome[r.primeiroLivre.barbeiroId],
          },
        };
      });
    },
  );

  /** Avulso em até 3 toques: serviço, barbeiro (ou primeiro livre), WhatsApp opcional. */
  fastify.post<{
    Body: {
      servicoId?: number | null;
      barbeiroId?: number | null;
      telefone?: string | null;
      nome?: string | null;
    } | null;
  }>(
    '/balcao/avulsos',
    {
      ...operar,
      schema: corpo({
        servicoId: inteiro,
        barbeiroId: inteiro,
        telefone: texto(TAM.telefone),
        nome: texto(TAM.nome),
      }),
    },
    async (req, reply) => {
      const config = await configDoBalcao(req);
      const { servicoId, barbeiroId, telefone, nome } = req.body ?? {};
      const digitos = String(telefone ?? '').replace(/\D/g, '');
      if (config.exigirTelefone && !digitos)
        throw invalido('Informe o WhatsApp do cliente.');
      const r = await na(req, async (c) => {
        await exigirCaixaAberto(c);
        // Os buscar* fazem Number(id): o mesmo valor de antes da conversão.
        const servico = await buscarServico(c, Number(servicoId));
        if (barbeiroId) await buscarBarbeiro(c, barbeiroId);
        const clienteId = digitos
          ? await clientePorTelefone(c, req.contexto.barbeariaId, {
              telefone: digitos,
              nome: String(nome ?? '').trim() || 'Cliente balcão',
            })
          : null;
        const novo = await c.db
          .insertInto('atendimentos')
          .values({
            barbeariaId: req.contexto.barbeariaId,
            origem: 'avulso',
            canal: 'balcao',
            data: agora().data,
            duracao: servico.duracao,
            barbeiroId: barbeiroId ? Number(barbeiroId) : null,
            servicoId: servico.id,
            clienteId,
            clienteNome: clienteId ? null : String(nome ?? '').trim() || null,
            estado: 'na_fila',
            chegouEm: sql<Date>`now()`,
            criadoPor: req.contexto.usuarioId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const a = await obterAtendimento(c, novo.id);
        await comandaDoAtendimento(c, req.contexto.barbeariaId, a);
        return obterAtendimento(c, novo.id);
      });
      reply.code(201);
      return r;
    },
  );

  /** Colunas que mudam junto com o status (horários e barbeiro). */
  interface Junto {
    chegouEm?: RawBuilder<Date>;
    iniciadoEm?: RawBuilder<Date>;
    finalizadoEm?: RawBuilder<Date>;
    barbeiroId?: number;
    inicio?: string;
    fim?: string;
  }

  /** Muda o status seguindo o ciclo de vida da especificação. */
  async function transitar(
    c: Conexao,
    a: AtendimentoNaAgenda,
    para: string,
    junto: Junto = {},
  ): Promise<void> {
    if (!podeTransitar(a.status, para))
      throw conflito('Esse atendimento não pode mais mudar para essa etapa.');
    await c.db
      .updateTable('atendimentos')
      .set({ estado: para, ...junto })
      .where('id', '=', a.id)
      .execute();
  }

  const agoraNoBanco = () => sql<Date>`now()`;

  fastify.post<ComId>('/atendimentos/:id/checkin', operar, (req) =>
    na(req, async (c) => {
      await exigirCaixaAberto(c);
      const a = await obterAtendimento(c, req.params.id, { travar: true });
      await transitar(c, a, 'chegou', { chegouEm: agoraNoBanco() });
      await comandaDoAtendimento(c, req.contexto.barbeariaId, a);
      return obterAtendimento(c, a.id);
    }),
  );

  fastify.post<ComId & { Body: { barbeiroId?: number | null } | null }>(
    '/atendimentos/:id/iniciar',
    { ...operar, schema: corpo({ barbeiroId: inteiro }) },
    async (req) => {
      const config = await configDoBalcao(req);
      return na(req, async (c) => {
        const a = await obterAtendimento(c, req.params.id, { travar: true });
        const barbeiroId = Number(req.body?.barbeiroId ?? a.barbeiroId);
        if (!barbeiroId) throw invalido('Escolha quem vai atender.');
        const barbeiro = await buscarBarbeiro(c, barbeiroId, { travar: true });
        exigirNoBalcao(req, 'iniciar', {
          barbeiroId: a.barbeiroId,
          barbeiroUsuarioId: a.barbeiroUsuarioId,
          destinoUsuarioId: barbeiro.usuarioId,
        });
        if (barbeiro.emPausa) throw conflito(`${barbeiro.nome} está em pausa.`);
        const ocupado = await c.db
          .selectFrom('atendimentos')
          .select('id')
          .where('barbeiroId', '=', barbeiro.id)
          .where('estado', '=', 'em_atendimento')
          .executeTakeFirst();
        if (ocupado) throw conflito(`${barbeiro.nome} já está atendendo.`);

        const { hora } = agora();
        let horario: { inicio: string; fim: string } | null = null;
        if (a.origem === 'avulso') {
          // O avulso nunca atropela quem agendou.
          const fim = fimDe(hora, a.duracao ?? 30);
          const reservados = await c.db
            .selectFrom('atendimentos as a')
            .leftJoin('clientes as cl', 'cl.id', 'a.clienteId')
            .select(['a.inicio', 'a.fim'])
            .select((eb) =>
              eb.fn.coalesce('cl.nome', eb.val('cliente')).as('nome'),
            )
            .where('a.barbeiroId', '=', barbeiro.id)
            .where('a.data', '=', agora().data)
            .where('a.id', '<>', a.id)
            .where((eb) =>
              eb.or([
                eb('a.estado', '=', 'chegou'),
                eb.and([
                  eb('a.estado', '=', 'agendado'),
                  eb(
                    'a.inicio',
                    '>=',
                    paraHora(
                      Math.max(0, paraMinutos(hora) - config.toleranciaMinutos),
                    ),
                  ),
                ]),
              ]),
            )
            .orderBy('a.inicio')
            .execute();
          const limite = paraMinutos(fim) + config.folgaMinutos;
          // Os reservados do dia têm horário (chegou ou agendado).
          const atropela = reservados.find(
            (r) =>
              paraMinutos(r.inicio ?? '') < limite &&
              paraMinutos(r.fim ?? '') > paraMinutos(hora),
          );
          if (atropela)
            throw conflito(
              `Isso atropela o agendamento das ${atropela.inicio} (${atropela.nome}) com ${barbeiro.nome}. Escolha outro barbeiro ou aguarde.`,
            );
          horario = { inicio: hora, fim };
        } else if (barbeiro.id !== a.barbeiroId && a.inicio && a.fim) {
          // Agendamento passado para outro barbeiro: o horário marcado tem de
          // estar livre na agenda dele.
          const choque = await c.db
            .selectFrom('atendimentos as a')
            .leftJoin('clientes as cl', 'cl.id', 'a.clienteId')
            .select('a.inicio')
            .select((eb) =>
              eb.fn
                .coalesce('cl.nome', 'a.clienteNome', eb.val('cliente'))
                .as('nome'),
            )
            .where('a.barbeiroId', '=', barbeiro.id)
            .where('a.data', '=', a.data)
            .where('a.id', '<>', a.id)
            .where('a.estado', 'in', ['agendado', 'chegou', 'em_atendimento'])
            .where('a.inicio', '<', a.fim)
            .where('a.fim', '>', a.inicio)
            .orderBy('a.inicio')
            .limit(1)
            .executeTakeFirst();
          if (choque)
            throw conflito(
              `${barbeiro.nome} tem o agendamento das ${choque.inicio} (${choque.nome}) nesse horário. Escolha outro barbeiro.`,
            );
          const bloqueio = await c.db
            .selectFrom('bloqueios')
            .select('id')
            .where('barbeiroId', '=', barbeiro.id)
            .where('data', '=', a.data)
            .where('cancelado', '=', false)
            .where('inicio', '<', a.fim)
            .where('fim', '>', a.inicio)
            .executeTakeFirst();
          if (bloqueio)
            throw conflito(
              `${barbeiro.nome} está com a agenda bloqueada nesse horário. Escolha outro barbeiro.`,
            );
        }
        await transitar(c, a, 'em_atendimento', {
          barbeiroId: barbeiro.id,
          iniciadoEm: agoraNoBanco(),
          ...(horario ?? {}),
        });
        await c.db
          .updateTable('comandas')
          .set((eb) => ({
            barbeiroId: eb.fn.coalesce('barbeiroId', eb.val(barbeiro.id)),
          }))
          .where('atendimentoId', '=', a.id)
          .where('estado', '=', 'aberta')
          .execute();
        return obterAtendimento(c, a.id);
      });
    },
  );

  fastify.post<ComId>('/atendimentos/:id/finalizar', operar, (req) =>
    na(req, async (c) => {
      const a = await obterAtendimento(c, req.params.id, { travar: true });
      exigirNoBalcao(req, 'finalizar', a);
      await transitar(c, a, 'finalizado', { finalizadoEm: agoraNoBanco() });
      return obterAtendimento(c, a.id);
    }),
  );

  fastify.post<ComId>('/atendimentos/:id/desistir', operar, (req) =>
    na(req, async (c) => {
      const a = await obterAtendimento(c, req.params.id, { travar: true });
      exigirNoBalcao(req, 'desistir', a);
      await transitar(c, a, 'desistiu');
      if (a.comandaId && a.comandaEstado === 'aberta')
        await cancelarComanda(c, a.comandaId);
      return obterAtendimento(c, a.id);
    }),
  );

  fastify.post<ComId>('/atendimentos/:id/no-show', operar, (req) =>
    na(req, async (c) => {
      const a = await obterAtendimento(c, req.params.id, { travar: true });
      exigirNoBalcao(req, 'no_show', a);
      await transitar(c, a, 'no_show');
      return obterAtendimento(c, a.id);
    }),
  );

  /** Pausa: o barbeiro some da sugestão de encaixe. */
  fastify.post<ComId & { Body: { emPausa?: boolean | null } | null }>(
    '/barbeiros/:id/pausa',
    { ...operar, schema: corpo({ emPausa: logico }) },
    (req) =>
      na(req, async (c) => {
        const b = await buscarBarbeiro(c, req.params.id);
        exigirNoBalcao(req, 'pausa', { barbeiroUsuarioId: b.usuarioId });
        await c.db
          .updateTable('barbeiros')
          .set({ emPausa: Boolean(req.body?.emPausa) })
          .where('id', '=', b.id)
          .execute();
        return { ...b, emPausa: Boolean(req.body?.emPausa) };
      }),
  );
}
