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
import { conflito, invalido, proibido } from '../../infra/erros.js';
import {
  SELECT_ATENDIMENTO,
  agora,
  buscarAtendimento,
  buscarBarbeiro,
  buscarServico,
  clientePorTelefone,
  comEstado,
} from '../../servicos/agenda.js';
import {
  cancelarComanda,
  comandaDoAtendimento,
  exigirCaixaAberto,
  caixaDoDia,
} from '../../servicos/caixa.js';
import { TAM, corpo, inteiro, logico, query, texto } from '../esquemas.js';

// Balcão (planejamento 0020, fase 1; especificação docs/atendimento/balcao.md).
// Agenda e fila são visões da mesma tabela `atendimentos`.

const PROXIMAS_HORAS = 3;

export default async function (fastify) {
  const operar = {
    preHandler: fastify.exigirAlguma('agenda.gerenciar', 'caixa.operar'),
  };
  const na = (req, fn) => fastify.naBarbearia(req, fn);

  // Quem só opera o caixa (Barbeiro) age no que é seu (planejamento 0036).
  const MOTIVOS = {
    iniciar: 'Você só pode iniciar atendimentos com você mesmo.',
    finalizar: 'Você só pode finalizar os seus atendimentos.',
    desistir:
      'Você só pode marcar desistência nos seus atendimentos ou nos que você lançou.',
    no_show:
      'Você só pode marcar falta nos seus atendimentos ou nos que você lançou.',
    pausa: 'Você só pode pausar a sua própria agenda.',
  };
  function exigirNoBalcao(req, acao, alvo) {
    if (!podeAgirNoBalcao(req.contexto, acao, alvo))
      throw proibido(MOTIVOS[acao] ?? 'Sem permissão para essa ação.');
  }

  async function configDoBalcao(req) {
    const { rows } = await fastify.db.query(
      'select configuracoes from barbearias where id = $1',
      [req.contexto.barbeariaId],
    );
    return mesclarConfigBarbearia(rows[0]?.configuracoes).balcao;
  }

  /** Tudo do dia que o balcão precisa: barbeiros, fila, próximos e a cobrar. */
  async function estadoDoDia(c, config) {
    const { data, hora } = agora();
    const { rows: barbeiros } = await c.query(
      `select id, nome, inicio, fim, em_pausa as "emPausa",
              usuario_id as "usuarioId" from barbeiros
        where excluido_em is null order by id`,
    );
    const { rows } = await c.query(
      `${SELECT_ATENDIMENTO} where a.data = $1 and a.estado not in ('cancelado', 'desistiu', 'no_show')
        order by a.inicio nulls last, a.chegou_em`,
      [data],
    );
    const atendimentos = rows.map(comEstado);
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

  fastify.get('/balcao', operar, async (req) => {
    const config = await configDoBalcao(req);
    return na(req, async (c) => {
      const d = await estadoDoDia(c, config);
      const limite = paraMinutos(d.hora) + PROXIMAS_HORAS * 60;
      const proximos = d.atendimentos.filter(
        (a) =>
          a.status === 'agendado' &&
          paraMinutos(a.inicio) + config.toleranciaMinutos >=
            paraMinutos(d.hora) &&
          paraMinutos(a.inicio) <= limite,
      );
      // Agendados que passaram da tolerância sem chegar: o balcão marca falta.
      const atrasados = d.atendimentos.filter(
        (a) =>
          a.status === 'agendado' &&
          paraMinutos(a.inicio) + config.toleranciaMinutos <
            paraMinutos(d.hora),
      );
      // Previsão de espera de cada um da fila (simulando os que estão à frente).
      const duracoes = Object.fromEntries(
        d.atendimentos.map((a) => [a.id, a.duracao ?? 30]),
      );
      const fila = d.fila.map((item, i) => {
        const r = sugerirEncaixe({
          situacao: d.situacao,
          fila: d.fila.slice(0, i),
          duracao: duracoes[item.id],
          agora: d.hora,
          folga: config.folgaMinutos,
        });
        const prev = item.barbeiroId
          ? r.porBarbeiro.find((p) => p.barbeiroId === item.barbeiroId)
          : r.primeiroLivre;
        return {
          ...item,
          estado: item.status,
          atrasado: item.status === 'chegou' && item.chegouAs > item.inicio,
          esperaMin: prev?.esperaMin ?? null,
          barbeiroSugeridoId: prev?.barbeiroId ?? item.barbeiroId ?? null,
          podeAgora: Boolean(prev?.podeAgora),
        };
      });
      const caixa = await caixaDoDia(c);
      const { rows: servicos } = await c.query(
        `select s.id, s.nome, s.duracao, s.preco, count(cm.id)::int as vendas
           from servicos s
           left join comandas cm on cm.estado = 'paga'
             -- Só os últimos 90 dias: a contagem não cresce com o histórico.
             and cm.caixa_id in (select id from caixas where data >= $1::date - 90)
             and cm.itens @> jsonb_build_array(jsonb_build_object('tipo', 'servico', 'refId', s.id))
          where s.excluido_em is null
          group by s.id order by vendas desc, s.nome`,
        [d.data],
      );
      return {
        data: d.data,
        agora: d.hora,
        config,
        caixaAberto: Boolean(caixa?.aberto),
        barbeiros: d.situacao.map((s) => ({
          ...s,
          // Conta ligada ao barbeiro: a tela mostra a quem só opera o caixa
          // (Barbeiro) apenas as ações sobre si mesmo (planejamento 0036).
          usuarioId: d.barbeiros.find((b) => b.id === s.id)?.usuarioId ?? null,
          atual: s.atual && {
            id: s.atual.id,
            clienteNome: s.atual.clienteNome,
            servicoNome: s.atual.servicoNome,
            comandaId: s.atual.comandaId,
          },
          proximo: s.reservados[0]
            ? {
                id: s.reservados[0].id,
                inicio: s.reservados[0].inicio,
                clienteNome: s.reservados[0].clienteNome,
              }
            : null,
          reservados: undefined,
        })),
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
  fastify.get(
    '/balcao/encaixe',
    { ...operar, schema: query({ servicoId: inteiro }) },
    async (req) => {
      const config = await configDoBalcao(req);
      return na(req, async (c) => {
        const servico = await buscarServico(c, req.query.servicoId);
        const d = await estadoDoDia(c, config);
        const r = sugerirEncaixe({
          situacao: d.situacao,
          fila: d.fila,
          duracao: servico.duracao,
          agora: d.hora,
          folga: config.folgaMinutos,
        });
        const nome = Object.fromEntries(d.barbeiros.map((b) => [b.id, b.nome]));
        return {
          porBarbeiro: r.porBarbeiro.map((p) => ({
            ...p,
            barbeiroNome: nome[p.barbeiroId],
            estado: d.situacao.find((s) => s.id === p.barbeiroId).estado,
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
  fastify.post(
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
        const servico = await buscarServico(c, servicoId);
        if (barbeiroId) await buscarBarbeiro(c, barbeiroId);
        const clienteId = digitos
          ? await clientePorTelefone(c, req.contexto.barbeariaId, {
              telefone: digitos,
              nome: String(nome ?? '').trim() || 'Cliente balcão',
            })
          : null;
        const {
          rows: [novo],
        } = await c.query(
          `insert into atendimentos
           (barbearia_id, origem, canal, data, duracao, barbeiro_id, servico_id, cliente_id, cliente_nome, estado, chegou_em, criado_por)
         values ($1, 'avulso', 'balcao', $2, $3, $4, $5, $6, $7, 'na_fila', now(), $8) returning id`,
          [
            req.contexto.barbeariaId,
            agora().data,
            servico.duracao,
            barbeiroId ? Number(barbeiroId) : null,
            servico.id,
            clienteId,
            clienteId ? null : String(nome ?? '').trim() || null,
            req.contexto.usuarioId,
          ],
        );
        const a = await buscarAtendimento(c, novo.id);
        await comandaDoAtendimento(c, req.contexto.barbeariaId, a);
        return buscarAtendimento(c, novo.id);
      });
      reply.code(201);
      return r;
    },
  );

  /** Muda o status seguindo o ciclo de vida da especificação. */
  async function transitar(c, a, para, extra = '') {
    if (!podeTransitar(a.status, para))
      throw conflito('Esse atendimento não pode mais mudar para essa etapa.');
    await c.query(
      `update atendimentos set estado = $2 ${extra} where id = $1`,
      [a.id, para],
    );
  }

  fastify.post('/atendimentos/:id/checkin', operar, (req) =>
    na(req, async (c) => {
      await exigirCaixaAberto(c);
      const a = await buscarAtendimento(c, req.params.id, { travar: true });
      await transitar(c, a, 'chegou', ', chegou_em = now()');
      await comandaDoAtendimento(c, req.contexto.barbeariaId, a);
      return buscarAtendimento(c, a.id);
    }),
  );

  fastify.post(
    '/atendimentos/:id/iniciar',
    { ...operar, schema: corpo({ barbeiroId: inteiro }) },
    async (req) => {
      const config = await configDoBalcao(req);
      return na(req, async (c) => {
        const a = await buscarAtendimento(c, req.params.id, { travar: true });
        const barbeiroId = Number(req.body?.barbeiroId ?? a.barbeiroId);
        if (!barbeiroId) throw invalido('Escolha quem vai atender.');
        const barbeiro = await buscarBarbeiro(c, barbeiroId, { travar: true });
        exigirNoBalcao(req, 'iniciar', { destinoUsuarioId: barbeiro.usuarioId });
        if (barbeiro.emPausa) throw conflito(`${barbeiro.nome} está em pausa.`);
        const ocupado = await c.query(
          "select 1 from atendimentos where barbeiro_id = $1 and estado = 'em_atendimento'",
          [barbeiro.id],
        );
        if (ocupado.rowCount)
          throw conflito(`${barbeiro.nome} já está atendendo.`);

        const { hora } = agora();
        let horario = '';
        if (a.origem === 'avulso') {
          // O avulso nunca atropela quem agendou.
          const fim = fimDe(hora, a.duracao ?? 30);
          const { rows: reservados } = await c.query(
            `select a.inicio, a.fim, coalesce(cl.nome, 'cliente') as nome
             from atendimentos a left join clientes cl on cl.id = a.cliente_id
            where a.barbeiro_id = $1 and a.data = $2 and a.id <> $3
              and (a.estado = 'chegou' or (a.estado = 'agendado' and a.inicio >= $4))
            order by a.inicio`,
            [
              barbeiro.id,
              agora().data,
              a.id,
              paraHora(
                Math.max(0, paraMinutos(hora) - config.toleranciaMinutos),
              ),
            ],
          );
          const limite = paraMinutos(fim) + config.folgaMinutos;
          const atropela = reservados.find(
            (r) =>
              paraMinutos(r.inicio) < limite &&
              paraMinutos(r.fim) > paraMinutos(hora),
          );
          if (atropela)
            throw conflito(
              `Isso atropela o agendamento das ${atropela.inicio} (${atropela.nome}) com ${barbeiro.nome}. Escolha outro barbeiro ou aguarde.`,
            );
          horario = `, inicio = '${hora}', fim = '${fim}'`;
        } else if (barbeiro.id !== a.barbeiroId && a.inicio && a.fim) {
          // Agendamento passado para outro barbeiro: o horário marcado tem de
          // estar livre na agenda dele.
          const {
            rows: [choque],
          } = await c.query(
            `select a.inicio, coalesce(cl.nome, a.cliente_nome, 'cliente') as nome
               from atendimentos a left join clientes cl on cl.id = a.cliente_id
              where a.barbeiro_id = $1 and a.data = $2 and a.id <> $3
                and a.estado in ('agendado', 'chegou', 'em_atendimento')
                and a.inicio < $5 and a.fim > $4
              order by a.inicio limit 1`,
            [barbeiro.id, a.data, a.id, a.inicio, a.fim],
          );
          if (choque)
            throw conflito(
              `${barbeiro.nome} tem o agendamento das ${choque.inicio} (${choque.nome}) nesse horário. Escolha outro barbeiro.`,
            );
          const bloqueio = await c.query(
            `select 1 from bloqueios
              where barbeiro_id = $1 and data = $2 and not cancelado
                and inicio < $4 and fim > $3`,
            [barbeiro.id, a.data, a.inicio, a.fim],
          );
          if (bloqueio.rowCount)
            throw conflito(
              `${barbeiro.nome} está com a agenda bloqueada nesse horário. Escolha outro barbeiro.`,
            );
        }
        await transitar(
          c,
          a,
          'em_atendimento',
          `, barbeiro_id = ${barbeiro.id}, iniciado_em = now()${horario}`,
        );
        await c.query(
          "update comandas set barbeiro_id = coalesce(barbeiro_id, $2) where atendimento_id = $1 and estado = 'aberta'",
          [a.id, barbeiro.id],
        );
        return buscarAtendimento(c, a.id);
      });
    },
  );

  fastify.post('/atendimentos/:id/finalizar', operar, (req) =>
    na(req, async (c) => {
      const a = await buscarAtendimento(c, req.params.id, { travar: true });
      exigirNoBalcao(req, 'finalizar', a);
      await transitar(c, a, 'finalizado', ', finalizado_em = now()');
      return buscarAtendimento(c, a.id);
    }),
  );

  fastify.post('/atendimentos/:id/desistir', operar, (req) =>
    na(req, async (c) => {
      const a = await buscarAtendimento(c, req.params.id, { travar: true });
      exigirNoBalcao(req, 'desistir', a);
      await transitar(c, a, 'desistiu');
      if (a.comandaId && a.comandaEstado === 'aberta')
        await cancelarComanda(c, a.comandaId);
      return buscarAtendimento(c, a.id);
    }),
  );

  fastify.post('/atendimentos/:id/no-show', operar, (req) =>
    na(req, async (c) => {
      const a = await buscarAtendimento(c, req.params.id, { travar: true });
      exigirNoBalcao(req, 'no_show', a);
      await transitar(c, a, 'no_show');
      return buscarAtendimento(c, a.id);
    }),
  );

  /** Pausa: o barbeiro some da sugestão de encaixe. */
  fastify.post(
    '/barbeiros/:id/pausa',
    { ...operar, schema: corpo({ emPausa: logico }) },
    (req) =>
      na(req, async (c) => {
        const b = await buscarBarbeiro(c, req.params.id);
        exigirNoBalcao(req, 'pausa', { barbeiroUsuarioId: b.usuarioId });
        await c.query('update barbeiros set em_pausa = $2 where id = $1', [
          b.id,
          Boolean(req.body?.emPausa),
        ]);
        return { ...b, emPausa: Boolean(req.body?.emPausa) };
      }),
  );
}
