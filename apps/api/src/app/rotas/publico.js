import { timingSafeEqual } from 'node:crypto';
import {
  horariosLivres,
  janelaDoAgendamentoOnline,
  mesclarConfigBarbearia,
  sobrepoe,
} from '@barbertime/dominio';
import { invalido, naoEncontrado } from '../../infra/erros.js';
import {
  agora,
  buscarBarbeiro,
  buscarServico,
  criarAgendamento,
  ocupadosDoDia,
} from '../../servicos/agenda.js';

/**
 * Página pública de agendamento (planejamento 0019, ADR 0013). Sem sessão.
 * Inexistente, desativada, sem o módulo ou com código errado: a MESMA resposta
 * 404, para não revelar que a barbearia existe.
 */
const NAO_ENCONTRADA = 'Barbearia não encontrada.';

const mesmoToken = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function (fastify) {
  /** Barbearia publicada pelo slug (+ código do link, se o modo pedir). */
  async function publicada(req) {
    const {
      rows: [b],
    } = await fastify.db.query(
      'select id, nome, slug, configuracoes, token_publico from barbearias where slug = $1',
      [String(req.params.slug)],
    );
    if (!b) throw naoEncontrado(NAO_ENCONTRADA);
    const config = mesclarConfigBarbearia(b.configuracoes);
    const modo = config.paginaPublica.modo;
    if (modo === 'desativada') throw naoEncontrado(NAO_ENCONTRADA);
    if (modo === 'com_link' && !mesmoToken(req.query.c, b.token_publico))
      throw naoEncontrado(NAO_ENCONTRADA);
    const ativo = await fastify.comBarbearia(b.id, (c) =>
      c.query(
        "select 1 from barbearia_modulos where modulo = 'agendamento_online' and estado = 'ativo'",
      ),
    );
    if (!ativo.rowCount) throw naoEncontrado(NAO_ENCONTRADA);
    return { id: b.id, nome: b.nome, slug: b.slug, config };
  }

  const janela = (config, barbeiro, data) =>
    janelaDoAgendamentoOnline({ config, barbeiro, data, agora: agora() });

  /** Tudo que a página precisa para começar. */
  fastify.get('/publico/:slug', async (req) => {
    const b = await publicada(req);
    return fastify.comBarbearia(b.id, async (c) => {
      const servicos = (
        await c.query(
          'select id, nome, duracao, preco from servicos where excluido_em is null order by nome',
        )
      ).rows;
      const barbeiros = (
        await c.query(
          'select id, nome, inicio, fim from barbeiros where excluido_em is null order by id',
        )
      ).rows;
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
  });

  fastify.get('/publico/:slug/horarios', async (req) => {
    const b = await publicada(req);
    const { data, barbeiroId, servicoId } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? '')))
      throw invalido('Escolha o dia.');
    return fastify.comBarbearia(b.id, async (c) => {
      const barbeiro = await buscarBarbeiro(c, barbeiroId);
      const servico = await buscarServico(c, servicoId);
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

  /** Só diz se o telefone já é cliente, com o PRIMEIRO nome (LGPD). */
  fastify.get('/publico/:slug/cliente', async (req) => {
    const b = await publicada(req);
    const telefone = String(req.query.telefone ?? '').replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(telefone)) return null;
    const {
      rows: [c],
    } = await fastify.comBarbearia(b.id, (cx) =>
      cx.query('select nome from clientes where telefone = $1', [telefone]),
    );
    return c ? { primeiroNome: c.nome.trim().split(/\s+/)[0] } : null;
  });

  fastify.post('/publico/:slug/agendamentos', async (req, reply) => {
    const b = await publicada(req);
    const { data, inicio, barbeiroId, servicoId, cliente } = req.body ?? {};
    const r = await fastify.comBarbearia(b.id, (c) =>
      criarAgendamento(
        c,
        b.id,
        {
          data,
          inicio,
          barbeiroId,
          servicoId,
          cliente: { nome: cliente?.nome, telefone: cliente?.telefone },
          origem: 'publico',
        },
        {
          validarJanela: ({ barbeiro, data: dia, inicio: ini, fim }) => {
            const j = janela(b.config, barbeiro, dia);
            const dentro =
              j &&
              ini >= (j.aPartirDe ?? j.inicio) &&
              ini >= j.inicio &&
              fim <= j.fim;
            if (!dentro || !sobrepoe({ inicio: ini, fim }, j))
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
      primeiroNome: r.clienteNome.trim().split(/\s+/)[0],
    };
  });
}
