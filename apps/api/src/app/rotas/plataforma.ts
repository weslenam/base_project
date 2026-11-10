import {
  ACOES_DE_MODULO_DA_PLATAFORMA,
  MODULOS,
  momentoNoFuso,
  seloDeAtividade,
  somarMeses,
  ticketMedio,
  totalDaComanda,
  resumoDoCaixa,
  transicaoPelaPlataforma,
  variacao,
} from '@barbertime/dominio';
import type { Comanda, ItemComanda } from '@barbertime/dominio';
import { sql } from 'kysely';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import operador, {
  COOKIE_OPERADOR,
  CAMINHO_DO_COOKIE,
  criarSessaoDeOperador,
  encerrarSessaoDeOperador,
  opcoesDoCookieDeOperador,
} from '../../seguranca/operador.ts';
import { conferirSenha, hashFalso } from '../../seguranca/senha.ts';
import { verificarTotp } from '../../seguranca/totp.ts';
import { chaves } from '../../seguranca/limites.ts';
import { corpo, inteiro, TAM, texto } from '../esquemas.ts';
import { invalido, naoAutenticado, naoEncontrado } from '../../infra/erros.ts';
import type { Conexao, ExecutorSql } from '../../infra/banco.ts';
import type { Operador } from '../tipos-fastify.ts';
import type {
  BarbeariaDaPlataforma,
  BarbeariaNaLista,
  IndicadoresDoPainel,
  ItemDoRanking,
  MudancaDeModulo,
  OperadorPublico,
  PainelDaBarbearia,
  RegistroDeAuditoria,
  SeloDeAtividade,
  TransferenciaDeDono,
} from './plataforma.contratos.ts';

/**
 * BarberTime Business Center (planejamento 0028, ADR 0018), sob /api/plataforma.
 * Só operadores (identidade separada, com TOTP). A lista usa só agregados; o
 * painel lê uma barbearia por vez pela RLS, em transação só de leitura. Nenhuma
 * resposta traz dado pessoal de cliente. Toda ação e toda abertura de painel
 * vão para a auditoria.
 *
 * Tabelas globais (`operadores`, `barbearias`, `auditoria_plataforma`) são
 * lidas no pool com o driver pg; o que roda na transação da barbearia usa o
 * Kysely dela (planejamento 0040).
 */

const ERRO_DE_ENTRADA = 'E-mail, senha ou código incorretos.';
const TOP = 5;

const params = {
  params: {
    type: 'object',
    properties: { id: { type: 'integer' } },
    required: ['id'],
  },
};
const comMotivo = (extras: Record<string, unknown> = {}) => ({
  ...params,
  ...corpo({ motivo: texto(500), ...extras }),
});

type ComMotivo = { motivo?: string | null } | undefined;

function exigirMotivo(body: ComMotivo): string {
  const motivo = String(body?.motivo ?? '').trim();
  if (motivo.length < 3) throw invalido('Informe o motivo.');
  return motivo;
}

/**
 * Operador da requisição. As rotas que chamam têm a guarda
 * `operadorAutenticado`; sem operador, falha fechado (401).
 */
function operadorDe(req: FastifyRequest): Operador {
  if (!req.operador) throw naoAutenticado();
  return req.operador;
}

/**
 * Registro na auditoria. Roda no pool ou na transação de quem chamou (para a
 * auditoria valer junto com a ação), por isso usa o driver pg.
 */
const auditar = (
  db: ExecutorSql,
  req: FastifyRequest,
  acao: string,
  {
    barbeariaId = null,
    motivo = null,
    dados = {},
  }: {
    barbeariaId?: number | null;
    motivo?: string | null;
    dados?: unknown;
  } = {},
) =>
  db.query(
    `insert into auditoria_plataforma (operador_id, barbearia_id, acao, motivo, dados)
     values ($1, $2, $3, $4, $5)`,
    [operadorDe(req).id, barbeariaId, acao, motivo, JSON.stringify(dados)],
  );

async function exigirBarbearia(
  db: ExecutorSql,
  id: number,
): Promise<BarbeariaDaPlataforma> {
  const {
    rows: [b],
  } = await db.query<BarbeariaDaPlataforma>(
    `select id, nome, slug, criada_em as "criadaEm", suspensa_em as "suspensaEm",
            motivo_suspensao as "motivoSuspensao"
       from barbearias where id = $1`,
    [id],
  );
  if (!b) throw naoEncontrado('Barbearia não encontrada.');
  return b;
}

/** Selo da lista; a data do caixa (sem hora) conta como o fim daquele dia. */
const seloDe = (
  b: {
    criadaEm: Date;
    ultimaComandaPaga: string | null;
    suspensaEm: Date | null;
  },
  agora = new Date(),
): SeloDeAtividade =>
  seloDeAtividade({
    criadaEm: b.criadaEm,
    ultimaComandaPaga: b.ultimaComandaPaga
      ? `${b.ultimaComandaPaga}T23:59:59-03:00`
      : null,
    suspensaEm: b.suspensaEm,
    agora,
  });

/** Soma por item (serviço ou produto) das comandas pagas, ordenado por valor. */
function ranking(comandas: Comanda[], tipo: string): ItemDoRanking[] {
  const porItem = new Map<
    string,
    { nome: string | undefined; quantidade: number; centavos: number }
  >();
  for (const c of comandas)
    for (const i of c.itens ?? []) {
      if ((i.tipo === 'produto') !== (tipo === 'produto')) continue;
      const chave = `${i.refId}:${i.nome}`;
      const atual = porItem.get(chave) ?? {
        nome: i.nome,
        quantidade: 0,
        centavos: 0,
      };
      const qtd = i.quantidade ?? 1;
      atual.quantidade += qtd;
      atual.centavos += Math.round(Number(i.preco) * 100) * qtd;
      porItem.set(chave, atual);
    }
  return [...porItem.values()]
    .sort((a, b) => b.centavos - a.centavos || b.quantidade - a.quantidade)
    .slice(0, TOP)
    .map(({ nome, quantidade, centavos }) => ({
      nome,
      quantidade,
      valor: centavos / 100,
    }));
}

function somarComandas(comandas: Comanda[]) {
  const centavos = comandas.reduce(
    (s, c) => s + Math.round(totalDaComanda(c).total * 100),
    0,
  );
  return { faturamento: centavos / 100, quantidade: comandas.length };
}

/** Indicadores da barbearia, lidos no contexto dela (RLS), só de leitura. */
async function painel(
  c: Conexao,
  hoje: string,
): Promise<IndicadoresDoPainel & { ultimaComandaPaga: string | null }> {
  const inicio = `${hoje.slice(0, 7)}-01`;
  const anterior = somarMeses(inicio, -1);
  // Comando de transação: não há construtor no Kysely.
  await sql`set transaction read only`.execute(c.db);

  const pagas = await c.db
    .selectFrom('comandas as cm')
    .innerJoin('caixas as cx', 'cx.id', 'cm.caixaId')
    .select((eb) => [
      eb.ref('cm.itens').$castTo<ItemComanda[]>().as('itens'),
      'cm.desconto',
      'cm.cashbackUsado',
      'cm.forma',
      'cm.estado',
      'cm.clienteId',
      'cx.data',
    ])
    .where('cm.estado', '=', 'paga')
    .where('cx.data', '>=', anterior)
    .where('cx.data', '<=', hoje)
    .execute();
  const doMes = pagas.filter((p) => p.data >= inicio);
  const doAnterior = pagas.filter((p) => p.data < inicio);
  const atual = somarComandas(doMes);
  const antes = somarComandas(doAnterior);

  const porDia = new Map<string, number>();
  for (const p of doMes)
    porDia.set(
      p.data,
      (porDia.get(p.data) ?? 0) + Math.round(totalDaComanda(p).total * 100),
    );

  // Contagens com `filter`: expressões em `sql` (com parâmetro), o resto no
  // construtor do Kysely.
  const [clientes, agendamentos, caixa, usuarios, modulos, ultima] =
    await Promise.all([
      c.db
        .selectFrom('clientes')
        .select([
          sql<number>`count(*)::int`.as('total'),
          sql<number>`count(*) filter (where criado_em >= ${inicio}::date)::int`.as(
            'novos',
          ),
        ])
        .where('excluidoEm', 'is', null)
        .executeTakeFirstOrThrow(),
      c.db
        .selectFrom('atendimentos')
        .select([
          sql<number>`count(*)::int`.as('marcados'),
          sql<number>`count(*) filter (where estado = 'no_show')::int`.as(
            'noShow',
          ),
          sql<number>`count(*) filter (where estado = 'cancelado')::int`.as(
            'cancelados',
          ),
        ])
        .where('origem', '=', 'agendamento')
        .where('data', '>=', inicio)
        .where('data', '<', somarMeses(inicio, 1))
        .executeTakeFirstOrThrow(),
      c.db
        .selectFrom('caixas')
        .select(['id', 'data', 'abertoAs', 'valorInicial'])
        .where('aberto', '=', true)
        .orderBy('data', 'desc')
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirst(),
      c.db
        .selectFrom('vinculos as v')
        .innerJoin('usuarios as u', 'u.id', 'v.usuarioId')
        .innerJoin('papeis as p', 'p.id', 'v.papelId')
        .select([
          'u.id',
          'u.nome',
          'u.email',
          'v.ativo',
          'p.chave as papelChave',
          'p.nome as papelNome',
        ])
        .orderBy(sql`p.chave = 'dono'`, 'desc')
        .orderBy('u.nome')
        .execute(),
      c.db
        .selectFrom('barbeariaModulos')
        .select(['modulo', 'estado', 'atualizadoEm'])
        .execute(),
      c.db
        .selectFrom('comandas as cm')
        .innerJoin('caixas as cx', 'cx.id', 'cm.caixaId')
        .select((eb) => eb.fn.max('cx.data').as('data'))
        .where('cm.estado', '=', 'paga')
        .executeTakeFirstOrThrow(),
    ]);

  let caixaAtual: IndicadoresDoPainel['caixa'] = null;
  if (caixa) {
    const cx = caixa;
    const doCaixa = await c.db
      // Cashback abate como desconto (planejamento 0037).
      .selectFrom('comandas')
      .select((eb) => [
        eb.ref('itens').$castTo<ItemComanda[]>().as('itens'),
        'desconto',
        'cashbackUsado',
        'forma',
        'estado',
      ])
      .where('caixaId', '=', cx.id)
      .execute();
    // Saídas e entradas da gaveta pelo financeiro (issue #26).
    const movimentos = await c.db
      .selectFrom('movimentosCaixa')
      .select(['tipo', 'valor'])
      .where('caixaId', '=', cx.id)
      .where('estornadoEm', 'is', null)
      .execute();
    const r = resumoDoCaixa({
      valorInicial: cx.valorInicial,
      comandas: doCaixa,
      movimentos,
    });
    caixaAtual = {
      data: cx.data,
      abertoAs: cx.abertoAs,
      valorInicial: cx.valorInicial,
      totalRecebido: r.totalRecebido,
      dinheiroEsperado: r.dinheiroEsperado,
      pagas: r.pagas,
      abertas: r.abertas,
    };
  }

  const estados = new Map(modulos.map((m) => [m.modulo, m]));
  const ticketAtual = ticketMedio(atual.faturamento, atual.quantidade);
  const ticketAntes = ticketMedio(antes.faturamento, antes.quantidade);
  return {
    ultimaComandaPaga: ultima.data,
    mes: { inicio, anterior, hoje },
    faturamento: {
      atual: atual.faturamento,
      anterior: antes.faturamento,
      variacao: variacao(atual.faturamento, antes.faturamento),
    },
    atendimentos: {
      atual: atual.quantidade,
      anterior: antes.quantidade,
      variacao: variacao(atual.quantidade, antes.quantidade),
    },
    ticketMedio: {
      atual: ticketAtual,
      anterior: ticketAntes,
      variacao: variacao(ticketAtual, ticketAntes),
    },
    clientes: {
      ...clientes,
      atendidos: new Set(doMes.map((p) => p.clienteId).filter(Boolean)).size,
    },
    agendamentos,
    topServicos: ranking(doMes, 'servico'),
    topProdutos: ranking(doMes, 'produto'),
    porDia: [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, centavos]) => ({ data, valor: centavos / 100 })),
    caixa: caixaAtual,
    // Equipe da barbearia (não são clientes): necessária para transferir o Dono.
    usuarios,
    modulos: MODULOS.map((m) => ({
      chave: m.chave,
      nome: m.nome,
      tipo: m.tipo,
      estado: estados.get(m.chave)?.estado ?? 'inativo',
      atualizadoEm: estados.get(m.chave)?.atualizadoEm ?? null,
    })),
  };
}

interface LinhaDoOperador {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  totp_segredo: string;
  totp_ultimo_passo: number;
}

type ComId = { Params: { id: number } };

async function rotas(fastify: FastifyInstance) {
  await fastify.register(operador);
  await hashFalso();

  // ---------- Entrar, sair e quem sou eu ----------
  const entrar = {
    schema: corpo({
      email: texto(TAM.email),
      senha: texto(TAM.senha),
      codigo: texto(10),
    }),
    preHandler: [
      fastify.limitar('operadorPorIp', chaves.ip),
      fastify.limitar('operadorPorEmail', chaves.email),
    ],
  };
  fastify.post<{
    Body:
      | {
          email?: string | null;
          senha?: string | null;
          codigo?: string | null;
        }
      | undefined;
  }>(
    '/auth/entrar',
    entrar,
    async (req, reply): Promise<{ operador: OperadorPublico }> => {
      const { email, senha, codigo } = req.body ?? {};
      const {
        rows: [op],
      } = await fastify.db.query<LinhaDoOperador>(
        `select id, nome, email, senha_hash, totp_segredo, totp_ultimo_passo
         from operadores where lower(email) = lower($1) and ativo`,
        [String(email ?? '')],
      );
      // Mesmo tempo e mesma resposta para e-mail inexistente, senha ou código
      // errados (ADR 0014). Sem operador, confere contra o hash falso.
      const confere = await conferirSenha(
        String(senha ?? ''),
        op ? op.senha_hash : await hashFalso(),
      );
      if (!op || !confere) throw naoAutenticado(ERRO_DE_ENTRADA);
      const passo = verificarTotp(op.totp_segredo, codigo, {
        ultimoPasso: Number(op.totp_ultimo_passo),
      });
      if (passo === null) throw naoAutenticado(ERRO_DE_ENTRADA);
      // Gasta o passo de forma atômica: duas requisições com o mesmo código não
      // passam as duas.
      const { rowCount } = await fastify.db.query(
        'update operadores set totp_ultimo_passo = $2 where id = $1 and totp_ultimo_passo < $2',
        [op.id, passo],
      );
      if (!rowCount) throw naoAutenticado(ERRO_DE_ENTRADA);

      const token = await criarSessaoDeOperador(fastify.db, op.id);
      const opcoesDoCookie = opcoesDoCookieDeOperador();
      reply.setCookie(COOKIE_OPERADOR, token, {
        ...opcoesDoCookie,
      });
      const publico = { id: op.id, nome: op.nome, email: op.email };
      // A resposta leva só os dados públicos; o token fica no cookie.
      req.operador = { ...publico, token };
      await auditar(fastify.db, req, 'entrar');
      return { operador: publico };
    },
  );

  fastify.post('/auth/sair', async (req, reply) => {
    await encerrarSessaoDeOperador(fastify.db, req.operador?.token);
    reply.clearCookie(COOKIE_OPERADOR, { path: CAMINHO_DO_COOKIE });
    return { ok: true };
  });

  fastify.get(
    '/auth/eu',
    { preHandler: fastify.operadorAutenticado },
    (req): { operador: OperadorPublico } => {
      const op = operadorDe(req);
      return { operador: { id: op.id, nome: op.nome, email: op.email } };
    },
  );

  // ---------- Barbearias ----------
  fastify.get(
    '/barbearias',
    { preHandler: fastify.operadorAutenticado },
    async (): Promise<BarbeariaNaLista[]> => {
      // `app.resumo_barbearias()` é função do banco (security definer, só
      // agregados): fica em SQL, no pool, sem parâmetro da requisição.
      const { rows } = await fastify.db.query<Omit<BarbeariaNaLista, 'selo'>>(
        `select b.id, b.nome, b.slug, b.criada_em as "criadaEm",
                b.suspensa_em as "suspensaEm", b.motivo_suspensao as "motivoSuspensao",
                r.faturamento_mes as "faturamentoMes",
                r.ultima_comanda_paga as "ultimaComandaPaga",
                r.modulos_pendentes as "modulosPendentes",
                r.dono_nome as "donoNome", r.dono_email as "donoEmail"
           from barbearias b
           join resumo_barbearias() r on r.barbearia_id = b.id
          order by b.nome`,
      );
      const agora = new Date();
      return rows.map((b) => ({ ...b, selo: seloDe(b, agora) }));
    },
  );

  fastify.get<ComId>(
    '/barbearias/:id',
    { schema: params, preHandler: fastify.operadorAutenticado },
    async (req): Promise<PainelDaBarbearia> => {
      const id = req.params.id;
      const dados = await exigirBarbearia(fastify.db, id);
      await auditar(fastify.db, req, 'ver_painel', { barbeariaId: id });
      const fuso = 'America/Sao_Paulo';
      const { ultimaComandaPaga, ...indicadores } = await fastify.comBarbearia(
        id,
        (c) => painel(c, momentoNoFuso(new Date(), fuso).data),
      );
      const comUltima = { ...dados, ultimaComandaPaga };
      const barbearia = { ...comUltima, selo: seloDe(comUltima) };
      const { rows: auditoria } = await fastify.db.query<RegistroDeAuditoria>(
        `select a.id, a.acao, a.motivo, a.dados, a.criada_em as "criadaEm",
                o.nome as "operadorNome"
           from auditoria_plataforma a join operadores o on o.id = a.operador_id
          where a.barbearia_id = $1 and a.acao <> 'ver_painel'
          order by a.criada_em desc, a.id desc limit 50`,
        [id],
      );
      return { barbearia, ...indicadores, auditoria };
    },
  );

  // ---------- Ações ----------
  fastify.post<{
    Params: { id: number; chave: string; acao: string };
    Body: ComMotivo;
  }>(
    '/barbearias/:id/modulos/:chave/:acao',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            chave: { type: 'string', maxLength: 40 },
            acao: { type: 'string', enum: [...ACOES_DE_MODULO_DA_PLATAFORMA] },
          },
          required: ['id', 'chave', 'acao'],
        },
        ...corpo({ motivo: texto(500) }),
      },
      preHandler: fastify.operadorAutenticado,
    },
    async (req): Promise<MudancaDeModulo> => {
      const { id, chave, acao } = req.params;
      const motivo = exigirMotivo(req.body);
      await exigirBarbearia(fastify.db, id);
      const resultado = await fastify.comBarbearia(id, async (c) => {
        const atual = await c.db
          .selectFrom('barbeariaModulos')
          .select('estado')
          .where('modulo', '=', chave)
          .executeTakeFirst();
        const de = atual?.estado ?? 'inativo';
        const { estado, erro } = transicaoPelaPlataforma(chave, de, acao);
        if (erro) throw invalido(erro);
        // Sem erro, a transição sempre devolve o estado novo.
        if (estado === undefined) throw new Error('Transição sem estado.');
        await c.db
          .insertInto('barbeariaModulos')
          .values({ barbeariaId: id, modulo: chave, estado })
          .onConflict((oc) =>
            oc.columns(['barbeariaId', 'modulo']).doUpdateSet({
              estado: (eb) => eb.ref('excluded.estado'),
              atualizadoEm: sql<Date>`now()`,
            }),
          )
          .execute();
        const dados = { chave, de, para: estado };
        await auditar(c, req, `modulo_${acao}`, {
          barbeariaId: id,
          motivo,
          dados,
        });
        return dados;
      });
      return resultado;
    },
  );

  fastify.post<ComId & { Body: ComMotivo }>(
    '/barbearias/:id/suspender',
    { schema: comMotivo(), preHandler: fastify.operadorAutenticado },
    async (req): Promise<BarbeariaDaPlataforma> => {
      const id = req.params.id;
      const motivo = exigirMotivo(req.body);
      const b = await exigirBarbearia(fastify.db, id);
      if (b.suspensaEm) throw invalido('A barbearia já está suspensa.');
      await fastify.emTransacao(async (c) => {
        await c.db
          .updateTable('barbearias')
          .set({ suspensaEm: sql<Date>`now()`, motivoSuspensao: motivo })
          .where('id', '=', id)
          .execute();
        // Quem está dentro sai na hora.
        await fastify.identidade.encerrarSessoesDaBarbearia(c, id);
        await auditar(c, req, 'suspender', { barbeariaId: id, motivo });
      });
      return exigirBarbearia(fastify.db, id);
    },
  );

  fastify.post<ComId & { Body: ComMotivo }>(
    '/barbearias/:id/reativar',
    { schema: comMotivo(), preHandler: fastify.operadorAutenticado },
    async (req): Promise<BarbeariaDaPlataforma> => {
      const id = req.params.id;
      const motivo = exigirMotivo(req.body);
      const b = await exigirBarbearia(fastify.db, id);
      if (!b.suspensaEm) throw invalido('A barbearia não está suspensa.');
      await fastify.emTransacao(async (c) => {
        await c.db
          .updateTable('barbearias')
          .set({ suspensaEm: null, motivoSuspensao: null })
          .where('id', '=', id)
          .execute();
        await auditar(c, req, 'reativar', {
          barbeariaId: id,
          motivo,
          dados: { motivoDaSuspensao: b.motivoSuspensao },
        });
      });
      return exigirBarbearia(fastify.db, id);
    },
  );

  /** Transferir o Dono: o alvo vira Dono, o Dono atual vira Gerente. */
  fastify.post<
    ComId & {
      Body: { motivo?: string | null; usuarioId?: number | null } | undefined;
    }
  >(
    '/barbearias/:id/dono',
    {
      schema: comMotivo({ usuarioId: inteiro }),
      preHandler: fastify.operadorAutenticado,
    },
    async (req): Promise<TransferenciaDeDono> => {
      const id = req.params.id;
      const motivo = exigirMotivo(req.body);
      const usuarioId = Number(req.body?.usuarioId);
      if (!usuarioId) throw invalido('Escolha quem será o novo Dono.');
      await exigirBarbearia(fastify.db, id);
      const dados = await fastify.comBarbearia(id, async (c) => {
        const papeis = await c.db
          .selectFrom('papeis')
          .select(['id', 'chave'])
          .where('chave', 'in', ['dono', 'gerente'])
          .execute();
        const papel: Record<string, number | undefined> = Object.fromEntries(
          papeis.map((p) => [p.chave, p.id]),
        );
        const { dono, gerente } = papel;
        // Toda barbearia nasce com os papéis padrão; sem eles, erro interno.
        if (dono === undefined || gerente === undefined)
          throw new Error('A barbearia não tem os papéis Dono e Gerente.');
        const alvo = await c.db
          .selectFrom('vinculos')
          .select(['usuarioId', 'papelId', 'ativo'])
          .where('usuarioId', '=', usuarioId)
          .executeTakeFirst();
        if (!alvo || !alvo.ativo)
          throw invalido(
            'O novo Dono precisa ter acesso ativo nesta barbearia.',
          );
        if (alvo.papelId === dono) throw invalido('Esta pessoa já é o Dono.');
        const antigos = await c.db
          .updateTable('vinculos')
          .set({ papelId: gerente })
          .where('papelId', '=', dono)
          .returning('usuarioId')
          .execute();
        await c.db
          .updateTable('vinculos')
          .set({ papelId: dono })
          .where('usuarioId', '=', usuarioId)
          .execute();
        const resultado = {
          novoDono: usuarioId,
          antigosDonos: antigos.map((a) => a.usuarioId),
        };
        await auditar(c, req, 'transferir_dono', {
          barbeariaId: id,
          motivo,
          dados: resultado,
        });
        return resultado;
      });
      return dados;
    },
  );
}

export default rotas;
