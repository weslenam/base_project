import {
  TIPOS_DE_PRODUTO,
  UNIDADES,
  arredondarQuantidade,
  paraMinutos,
} from '@barbertime/dominio';
import { conflito, invalido, naoEncontrado } from '../../infra/erros.js';
import { agora } from '../../servicos/agenda.js';
import { TAM, campoHora, corpo, escalar, inteiro, texto } from '../esquemas.js';

// Serviços, produtos e equipe (planejamento 0019). Exclusão lógica: o histórico
// de agendamentos e comandas continua apontando para o registro.

const plural = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;

/** Agendamentos futuros (não cancelados nem bloqueios) que usam o registro. */
async function futurosCom(c, coluna, id) {
  const { rows } = await c.query(
    `select count(*)::int as n from atendimentos
      where ${coluna} = $1 and data >= $2 and estado in ('agendado', 'chegou', 'na_fila', 'em_atendimento')`,
    [id, agora().data],
  );
  return rows[0].n;
}

async function negarSeEmUso(c, coluna, id, nome) {
  const n = await futurosCom(c, coluna, id);
  if (n) {
    throw conflito(
      `Não é possível excluir "${nome}": há ${plural(n, 'agendamento')} ${n > 1 ? 'futuros' : 'futuro'}. Cancele ou remarque antes.`,
    );
  }
}

async function nomeRepetido(c, tabela, nome, id, rotulo) {
  const {
    rows: [r],
  } = await c.query(
    `select nome from ${tabela} where lower(nome) = lower($1) and excluido_em is null and id <> coalesce($2::bigint, 0)`,
    [nome, id ?? null],
  );
  if (r) throw conflito(`Já existe ${rotulo} chamado "${r.nome}".`);
}

async function obterAtivo(c, tabela, id, rotulo) {
  const {
    rows: [r],
  } = await c.query(
    `select * from ${tabela} where id = $1 and excluido_em is null`,
    [Number(id)],
  );
  if (!r) throw naoEncontrado(`${rotulo} não encontrado.`);
  return r;
}

const SERVICO = 'select id, nome, duracao, preco from servicos';
const PRODUTO = `select id, nome, preco, comissao, tipo, unidade,
  estoque_minimo as "estoqueMinimo", ultimo_custo as "ultimoCusto", saldo from produtos`;
const BARBEIRO =
  'select id, nome, inicio, fim, comissao, usuario_id as "usuarioId", em_pausa as "emPausa" from barbeiros';

export default async function (fastify) {
  const logado = { preHandler: fastify.autenticado };
  const catalogo = { preHandler: fastify.exigir('catalogo.gerenciar') };
  const equipe = { preHandler: fastify.exigir('equipe.gerenciar') };
  const servico = {
    ...catalogo,
    schema: corpo({
      nome: texto(TAM.nome),
      duracao: escalar(),
      preco: escalar(),
    }),
  };
  const produto = {
    ...catalogo,
    schema: corpo({
      nome: texto(TAM.nome),
      preco: escalar(),
      comissao: escalar(),
      tipo: texto(20),
      unidade: texto(5),
      estoqueMinimo: escalar(),
    }),
  };
  const barbeiro = {
    ...equipe,
    schema: corpo({
      nome: texto(TAM.nome),
      inicio: campoHora,
      fim: campoHora,
      comissao: escalar(),
      usuarioId: inteiro,
    }),
  };
  const na = (req, fn) => fastify.naBarbearia(req, fn);

  // ---- serviços ----
  fastify.get('/servicos', logado, (req) =>
    na(
      req,
      async (c) =>
        (await c.query(`${SERVICO} where excluido_em is null order by nome`))
          .rows,
    ),
  );

  fastify.get('/servicos/:id/futuros', logado, (req) =>
    na(req, async (c) => ({
      total: await futurosCom(c, 'servico_id', Number(req.params.id)),
    })),
  );

  const salvarServico = (req) =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do serviço.');
      if (!(Number(d.duracao) > 0))
        throw invalido('A duração precisa ser maior que zero.');
      if (!(Number(d.preco) >= 0) || d.preco === null || d.preco === '')
        throw invalido('Informe o preço do serviço.');
      await nomeRepetido(c, 'servicos', nome, id, 'um serviço');
      const valores = [nome, Math.round(Number(d.duracao)), Number(d.preco)];
      if (id) {
        await obterAtivo(c, 'servicos', id, 'Serviço');
        await c.query(
          'update servicos set nome = $2, duracao = $3, preco = $4 where id = $1',
          [id, ...valores],
        );
        return (await c.query(`${SERVICO} where id = $1`, [id])).rows[0];
      }
      return (
        await c.query(
          `insert into servicos (barbearia_id, nome, duracao, preco) values ($1, $2, $3, $4)
           returning id, nome, duracao, preco`,
          [req.contexto.barbeariaId, ...valores],
        )
      ).rows[0];
    });
  fastify.post('/servicos', servico, salvarServico);
  fastify.put('/servicos/:id', servico, salvarServico);

  fastify.delete('/servicos/:id', catalogo, async (req, reply) => {
    await na(req, async (c) => {
      const s = await obterAtivo(c, 'servicos', req.params.id, 'Serviço');
      await negarSeEmUso(c, 'servico_id', s.id, s.nome);
      await c.query('update servicos set excluido_em = now() where id = $1', [
        s.id,
      ]);
    });
    reply.code(204);
  });

  // ---- produtos ----
  // Custo e saldo só para quem vê o estoque (planejamento 0027).
  const semCusto = (req, p) => {
    if (req.contexto.permissoes.includes('estoque.ver')) return p;
    const { ultimoCusto, saldo, ...resto } = p;
    void ultimoCusto;
    void saldo;
    return resto;
  };
  fastify.get('/produtos', logado, (req) =>
    na(req, async (c) =>
      (
        await c.query(
          `${PRODUTO} where excluido_em is null order by nome collate "C"`,
        )
      ).rows
        .map((p) => semCusto(req, p))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    ),
  );

  const salvarProduto = (req) =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do produto.');
      // Planejamento 0027: consumível (uso interno) não tem preço nem comissão.
      const tipo = d.tipo ?? 'revenda';
      if (!TIPOS_DE_PRODUTO.includes(tipo))
        throw invalido('Escolha se o produto é de revenda ou consumível.');
      const revenda = tipo === 'revenda';
      if (revenda && !(Number(d.preco) > 0))
        throw invalido('Informe o preço de venda do produto.');
      const comissao = revenda ? Number(d.comissao ?? 0) : 0;
      if (!(comissao >= 0 && comissao <= 100))
        throw invalido('A comissão precisa estar entre 0% e 100%.');
      const unidade = d.unidade ?? 'un';
      if (!UNIDADES.includes(unidade)) throw invalido('Unidade inválida.');
      const minimo = Number(d.estoqueMinimo ?? 0);
      if (!(minimo >= 0))
        throw invalido('O estoque mínimo não pode ser negativo.');
      await nomeRepetido(c, 'produtos', nome, id, 'um produto');
      const valores = [
        nome,
        revenda ? Number(d.preco) : null,
        comissao,
        tipo,
        unidade,
        arredondarQuantidade(minimo),
      ];
      if (id) {
        const atual = await obterAtivo(c, 'produtos', id, 'Produto');
        if (atual.tipo === 'revenda' && tipo === 'consumivel') {
          const aberta = await c.query(
            `select 1 from comandas where estado = 'aberta'
               and itens @> jsonb_build_array(jsonb_build_object('tipo', 'produto', 'refId', $1::bigint))`,
            [id],
          );
          if (aberta.rowCount)
            throw conflito(
              'Esse produto está numa comanda em aberto. Receba ou tire da comanda antes de virar consumível.',
            );
        }
        await c.query(
          `update produtos set nome = $2, preco = $3, comissao = $4, tipo = $5,
             unidade = $6, estoque_minimo = $7 where id = $1`,
          [id, ...valores],
        );
        return semCusto(
          req,
          (await c.query(`${PRODUTO} where id = $1`, [id])).rows[0],
        );
      }
      const {
        rows: [novo],
      } = await c.query(
        `insert into produtos (barbearia_id, nome, preco, comissao, tipo, unidade, estoque_minimo)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [req.contexto.barbeariaId, ...valores],
      );
      return semCusto(
        req,
        (await c.query(`${PRODUTO} where id = $1`, [novo.id])).rows[0],
      );
    });
  fastify.post('/produtos', produto, salvarProduto);
  fastify.put('/produtos/:id', produto, salvarProduto);

  fastify.delete('/produtos/:id', catalogo, async (req, reply) => {
    await na(req, async (c) => {
      const p = await obterAtivo(c, 'produtos', req.params.id, 'Produto');
      await c.query('update produtos set excluido_em = now() where id = $1', [
        p.id,
      ]);
    });
    reply.code(204);
  });

  // ---- equipe ----
  fastify.get('/barbeiros', logado, (req) =>
    na(
      req,
      async (c) =>
        (await c.query(`${BARBEIRO} where excluido_em is null order by id`))
          .rows,
    ),
  );

  /** Contas ativas da barbearia que podem ser ligadas a um barbeiro (agenda própria). */
  async function contasDaBarbearia(c, barbeariaId) {
    const { rows } = await c.query(
      `select u.id, u.nome, u.email from vinculos v join usuarios u on u.id = v.usuario_id
        where v.barbearia_id = $1 and v.ativo order by u.nome`,
      [barbeariaId],
    );
    return rows;
  }
  fastify.get('/barbeiros/contas', equipe, (req) =>
    na(req, (c) => contasDaBarbearia(c, req.contexto.barbeariaId)),
  );

  /** Conta do barbeiro: precisa ser desta barbearia e não estar em outro barbeiro. */
  async function contaDoBarbeiro(c, req, id, usuarioId) {
    if (!usuarioId) return null;
    const conta = await c.query(
      'select 1 from vinculos where barbearia_id = $1 and usuario_id = $2 and ativo',
      [req.contexto.barbeariaId, usuarioId],
    );
    if (!conta.rowCount)
      throw invalido('Essa conta não é de um usuário desta barbearia.');
    const outro = await c.query(
      `select nome from barbeiros
        where usuario_id = $1 and excluido_em is null and id <> coalesce($2::bigint, 0)`,
      [usuarioId, id],
    );
    if (outro.rowCount)
      throw conflito(`Essa conta já está ligada a ${outro.rows[0].nome}.`);
    return usuarioId;
  }

  const salvarBarbeiro = (req) =>
    na(req, async (c) => {
      const id = req.params.id ? Number(req.params.id) : null;
      const d = req.body ?? {};
      const nome = String(d.nome ?? '').trim();
      if (!nome) throw invalido('Informe o nome do barbeiro.');
      const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (
        !hora.test(d.inicio ?? '') ||
        !hora.test(d.fim ?? '') ||
        paraMinutos(d.inicio) >= paraMinutos(d.fim)
      )
        throw invalido('O fim do expediente precisa ser depois do início.');
      const comissao = Number(d.comissao);
      if (!(comissao >= 0 && comissao <= 100))
        throw invalido('A comissão precisa estar entre 0% e 100%.');
      const valores = [nome, d.inicio, d.fim, comissao];
      // Sem o campo no corpo, a conta ligada continua como está.
      const mudaConta = Object.hasOwn(d, 'usuarioId');
      const usuarioId = mudaConta
        ? await contaDoBarbeiro(
            c,
            req,
            id,
            d.usuarioId ? Number(d.usuarioId) : null,
          )
        : null;
      if (id) {
        await obterAtivo(c, 'barbeiros', id, 'Barbeiro');
        await c.query(
          `update barbeiros set nome = $2, inicio = $3, fim = $4, comissao = $5,
             usuario_id = case when $6 then $7::bigint else usuario_id end
           where id = $1`,
          [id, ...valores, mudaConta, usuarioId],
        );
        return (await c.query(`${BARBEIRO} where id = $1`, [id])).rows[0];
      }
      const {
        rows: [novo],
      } = await c.query(
        `insert into barbeiros (barbearia_id, nome, inicio, fim, comissao, usuario_id)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [req.contexto.barbeariaId, ...valores, usuarioId],
      );
      return (await c.query(`${BARBEIRO} where id = $1`, [novo.id])).rows[0];
    });
  fastify.post('/barbeiros', barbeiro, salvarBarbeiro);
  fastify.put('/barbeiros/:id', barbeiro, salvarBarbeiro);

  fastify.delete('/barbeiros/:id', equipe, async (req, reply) => {
    await na(req, async (c) => {
      const b = await obterAtivo(c, 'barbeiros', req.params.id, 'Barbeiro');
      await negarSeEmUso(c, 'barbeiro_id', b.id, b.nome);
      // Bloqueios futuros do barbeiro saem junto.
      await c.query(
        'update bloqueios set cancelado = true where barbeiro_id = $1 and data >= $2',
        [b.id, agora().data],
      );
      await c.query('update barbeiros set excluido_em = now() where id = $1', [
        b.id,
      ]);
    });
    reply.code(204);
  });
}
