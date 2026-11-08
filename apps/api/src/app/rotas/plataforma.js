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
import operador, {
  COOKIE_OPERADOR,
  CAMINHO_DO_COOKIE,
  criarSessaoDeOperador,
  encerrarSessaoDeOperador,
  opcoesDoCookieDeOperador,
} from '../../seguranca/operador.js';
import { conferirSenha, hashFalso } from '../../seguranca/senha.js';
import { verificarTotp } from '../../seguranca/totp.js';
import { chaves } from '../../seguranca/limites.js';
import { corpo, inteiro, TAM, texto } from '../esquemas.js';
import { invalido, naoAutenticado, naoEncontrado } from '../../infra/erros.js';

/**
 * BarberTime Business Center (planejamento 0028, ADR 0018), sob /api/plataforma.
 * Só operadores (identidade separada, com TOTP). A lista usa só agregados; o
 * painel lê uma barbearia por vez pela RLS, em transação só de leitura. Nenhuma
 * resposta traz dado pessoal de cliente. Toda ação e toda abertura de painel
 * vão para a auditoria.
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
const comMotivo = (extras = {}) => ({
  ...params,
  ...corpo({ motivo: texto(500), ...extras }),
});

function exigirMotivo(body) {
  const motivo = String(body?.motivo ?? '').trim();
  if (motivo.length < 3) throw invalido('Informe o motivo.');
  return motivo;
}

const auditar = (
  db,
  req,
  acao,
  { barbeariaId = null, motivo = null, dados = {} } = {},
) =>
  db.query(
    `insert into auditoria_plataforma (operador_id, barbearia_id, acao, motivo, dados)
     values ($1, $2, $3, $4, $5)`,
    [req.operador.id, barbeariaId, acao, motivo, JSON.stringify(dados)],
  );

async function exigirBarbearia(db, id) {
  const {
    rows: [b],
  } = await db.query(
    `select id, nome, slug, criada_em as "criadaEm", suspensa_em as "suspensaEm",
            motivo_suspensao as "motivoSuspensao"
       from barbearias where id = $1`,
    [id],
  );
  if (!b) throw naoEncontrado('Barbearia não encontrada.');
  return b;
}

/** Selo da lista; a data do caixa (sem hora) conta como o fim daquele dia. */
const seloDe = (b, agora = new Date()) =>
  seloDeAtividade({
    criadaEm: b.criadaEm,
    ultimaComandaPaga: b.ultimaComandaPaga
      ? `${b.ultimaComandaPaga}T23:59:59-03:00`
      : null,
    suspensaEm: b.suspensaEm,
    agora,
  });

/** Soma por item (serviço ou produto) das comandas pagas, ordenado por valor. */
function ranking(comandas, tipo) {
  const porItem = new Map();
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

function somarComandas(comandas) {
  const centavos = comandas.reduce(
    (s, c) => s + Math.round(totalDaComanda(c).total * 100),
    0,
  );
  return { faturamento: centavos / 100, quantidade: comandas.length };
}

/** Indicadores da barbearia, lidos no contexto dela (RLS), só de leitura. */
async function painel(c, hoje) {
  const inicio = `${hoje.slice(0, 7)}-01`;
  const anterior = somarMeses(inicio, -1);
  await c.query('set transaction read only');

  const { rows: pagas } = await c.query(
    `select cm.itens, cm.desconto, cm.forma, cm.estado, cm.cliente_id as "clienteId",
            cx.data
       from comandas cm join caixas cx on cx.id = cm.caixa_id
      where cm.estado = 'paga' and cx.data >= $1 and cx.data <= $2`,
    [anterior, hoje],
  );
  const doMes = pagas.filter((p) => p.data >= inicio);
  const doAnterior = pagas.filter((p) => p.data < inicio);
  const atual = somarComandas(doMes);
  const antes = somarComandas(doAnterior);

  const porDia = new Map();
  for (const p of doMes)
    porDia.set(
      p.data,
      (porDia.get(p.data) ?? 0) + Math.round(totalDaComanda(p).total * 100),
    );

  const [clientes, agendamentos, caixa, usuarios, modulos, ultima] =
    await Promise.all([
      c.query(
        `select count(*)::int as total,
              count(*) filter (where criado_em >= $1::date)::int as novos
         from clientes where excluido_em is null`,
        [inicio],
      ),
      c.query(
        `select count(*)::int as marcados,
              count(*) filter (where estado = 'no_show')::int as "noShow",
              count(*) filter (where estado = 'cancelado')::int as cancelados
         from atendimentos
        where origem = 'agendamento' and data >= $1 and data < $2`,
        [inicio, somarMeses(inicio, 1)],
      ),
      c.query(
        `select id, data, aberto_as as "abertoAs", valor_inicial as "valorInicial"
         from caixas where aberto order by data desc, id desc limit 1`,
      ),
      c.query(
        `select u.id, u.nome, u.email, v.ativo, p.chave as "papelChave", p.nome as "papelNome"
         from vinculos v join usuarios u on u.id = v.usuario_id
         join papeis p on p.id = v.papel_id
        order by p.chave = 'dono' desc, u.nome`,
      ),
      c.query('select modulo, estado, atualizado_em from barbearia_modulos'),
      c.query(
        `select max(cx.data) as data from comandas cm join caixas cx on cx.id = cm.caixa_id
        where cm.estado = 'paga'`,
      ),
    ]);

  let caixaAtual = null;
  if (caixa.rows[0]) {
    const cx = caixa.rows[0];
    const { rows: doCaixa } = await c.query(
      'select itens, desconto, forma, estado from comandas where caixa_id = $1',
      [cx.id],
    );
    const r = resumoDoCaixa({
      valorInicial: cx.valorInicial,
      comandas: doCaixa,
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

  const estados = new Map(modulos.rows.map((m) => [m.modulo, m]));
  const ticketAtual = ticketMedio(atual.faturamento, atual.quantidade);
  const ticketAntes = ticketMedio(antes.faturamento, antes.quantidade);
  return {
    ultimaComandaPaga: ultima.rows[0].data,
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
      ...clientes.rows[0],
      atendidos: new Set(doMes.map((p) => p.clienteId).filter(Boolean)).size,
    },
    agendamentos: agendamentos.rows[0],
    topServicos: ranking(doMes, 'servico'),
    topProdutos: ranking(doMes, 'produto'),
    porDia: [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, centavos]) => ({ data, valor: centavos / 100 })),
    caixa: caixaAtual,
    // Equipe da barbearia (não são clientes): necessária para transferir o Dono.
    usuarios: usuarios.rows,
    modulos: MODULOS.map((m) => ({
      chave: m.chave,
      nome: m.nome,
      tipo: m.tipo,
      estado: estados.get(m.chave)?.estado ?? 'inativo',
      atualizadoEm: estados.get(m.chave)?.atualizado_em ?? null,
    })),
  };
}

async function rotas(fastify) {
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
  fastify.post('/auth/entrar', entrar, async (req, reply) => {
    const { email, senha, codigo } = req.body ?? {};
    const {
      rows: [op],
    } = await fastify.db.query(
      `select id, nome, email, senha_hash, totp_segredo, totp_ultimo_passo
         from operadores where lower(email) = lower($1) and ativo`,
      [String(email ?? '')],
    );
    // Mesmo tempo e mesma resposta para e-mail inexistente, senha ou código
    // errados (ADR 0014).
    const confere = await conferirSenha(
      String(senha ?? ''),
      op?.senha_hash ?? (await hashFalso()),
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
    reply.setCookie(COOKIE_OPERADOR, token, opcoesDoCookieDeOperador());
    req.operador = { id: op.id, nome: op.nome, email: op.email };
    await auditar(fastify.db, req, 'entrar');
    return { operador: req.operador };
  });

  fastify.post('/auth/sair', async (req, reply) => {
    await encerrarSessaoDeOperador(fastify.db, req.operador?.token);
    reply.clearCookie(COOKIE_OPERADOR, { path: CAMINHO_DO_COOKIE });
    return { ok: true };
  });

  fastify.get(
    '/auth/eu',
    { preHandler: fastify.operadorAutenticado },
    (req) => ({
      operador: {
        id: req.operador.id,
        nome: req.operador.nome,
        email: req.operador.email,
      },
    }),
  );

  // ---------- Barbearias ----------
  fastify.get(
    '/barbearias',
    { preHandler: fastify.operadorAutenticado },
    async () => {
      const { rows } = await fastify.db.query(
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

  fastify.get(
    '/barbearias/:id',
    { schema: params, preHandler: fastify.operadorAutenticado },
    async (req) => {
      const id = req.params.id;
      const barbearia = await exigirBarbearia(fastify.db, id);
      await auditar(fastify.db, req, 'ver_painel', { barbeariaId: id });
      const fuso = 'America/Sao_Paulo';
      const { ultimaComandaPaga, ...indicadores } = await fastify.comBarbearia(
        id,
        (c) => painel(c, momentoNoFuso(new Date(), fuso).data),
      );
      barbearia.ultimaComandaPaga = ultimaComandaPaga;
      barbearia.selo = seloDe(barbearia);
      const { rows: auditoria } = await fastify.db.query(
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
  fastify.post(
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
    async (req) => {
      const { id, chave, acao } = req.params;
      const motivo = exigirMotivo(req.body);
      await exigirBarbearia(fastify.db, id);
      const resultado = await fastify.comBarbearia(id, async (c) => {
        const {
          rows: [atual],
        } = await c.query(
          'select estado from barbearia_modulos where modulo = $1',
          [chave],
        );
        const de = atual?.estado ?? 'inativo';
        const { estado, erro } = transicaoPelaPlataforma(chave, de, acao);
        if (erro) throw invalido(erro);
        await c.query(
          `insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, $2, $3)
           on conflict (barbearia_id, modulo)
           do update set estado = excluded.estado, atualizado_em = now()`,
          [id, chave, estado],
        );
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

  fastify.post(
    '/barbearias/:id/suspender',
    { schema: comMotivo(), preHandler: fastify.operadorAutenticado },
    async (req) => {
      const id = req.params.id;
      const motivo = exigirMotivo(req.body);
      const b = await exigirBarbearia(fastify.db, id);
      if (b.suspensaEm) throw invalido('A barbearia já está suspensa.');
      await fastify.emTransacao(async (c) => {
        await c.query(
          'update barbearias set suspensa_em = now(), motivo_suspensao = $2 where id = $1',
          [id, motivo],
        );
        // Quem está dentro sai na hora.
        await fastify.identidade.encerrarSessoesDaBarbearia(c, id);
        await auditar(c, req, 'suspender', { barbeariaId: id, motivo });
      });
      return exigirBarbearia(fastify.db, id);
    },
  );

  fastify.post(
    '/barbearias/:id/reativar',
    { schema: comMotivo(), preHandler: fastify.operadorAutenticado },
    async (req) => {
      const id = req.params.id;
      const motivo = exigirMotivo(req.body);
      const b = await exigirBarbearia(fastify.db, id);
      if (!b.suspensaEm) throw invalido('A barbearia não está suspensa.');
      await fastify.emTransacao(async (c) => {
        await c.query(
          'update barbearias set suspensa_em = null, motivo_suspensao = null where id = $1',
          [id],
        );
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
  fastify.post(
    '/barbearias/:id/dono',
    {
      schema: comMotivo({ usuarioId: inteiro }),
      preHandler: fastify.operadorAutenticado,
    },
    async (req) => {
      const id = req.params.id;
      const motivo = exigirMotivo(req.body);
      const usuarioId = Number(req.body?.usuarioId);
      if (!usuarioId) throw invalido('Escolha quem será o novo Dono.');
      await exigirBarbearia(fastify.db, id);
      const dados = await fastify.comBarbearia(id, async (c) => {
        const { rows: papeis } = await c.query(
          "select id, chave from papeis where chave in ('dono', 'gerente')",
        );
        const papel = Object.fromEntries(papeis.map((p) => [p.chave, p.id]));
        const {
          rows: [alvo],
        } = await c.query(
          'select usuario_id, papel_id, ativo from vinculos where usuario_id = $1',
          [usuarioId],
        );
        if (!alvo || !alvo.ativo)
          throw invalido(
            'O novo Dono precisa ter acesso ativo nesta barbearia.',
          );
        if (alvo.papel_id === papel.dono)
          throw invalido('Esta pessoa já é o Dono.');
        const { rows: antigos } = await c.query(
          'update vinculos set papel_id = $1 where papel_id = $2 returning usuario_id',
          [papel.gerente, papel.dono],
        );
        await c.query(
          'update vinculos set papel_id = $1 where usuario_id = $2',
          [papel.dono, usuarioId],
        );
        const resultado = {
          novoDono: usuarioId,
          antigosDonos: antigos.map((a) => a.usuario_id),
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
