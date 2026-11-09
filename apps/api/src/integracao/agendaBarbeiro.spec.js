import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso } from '@barbertime/dominio';
import { criarServidor, navegador, novaBarbearia, unico } from './apoio.js';

// Planejamento 0035: o Barbeiro ajuda na agenda (agenda.ajudar). Marca e
// bloqueia em qualquer coluna; confirma e cancela só o que marcou; atendido e
// falta também na própria coluna; remove só os bloqueios que criou.

let servidor;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

function proximaSegunda() {
  const hoje = momentoNoFuso().data;
  const d = new Date(`${hoje}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1);
  return d.toISOString().slice(0, 10);
}

async function entrarComo(dono, chave) {
  const papel = (await dono.get('/api/papeis')).corpo.find(
    (p) => p.chave === chave,
  );
  const email = `${unico(chave)}@teste.dev`;
  const r = await dono.post('/api/usuarios', {
    nome: chave,
    email,
    senha: 'senha-segura',
    papelId: papel.id,
  });
  expect(r.status).toBe(201);
  const n = navegador(servidor);
  await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
  return { n, id: r.corpo.id };
}

/** Barbearia com Marcos (conta do Barbeiro), Léo (sem conta) e a Recepção. */
async function montada() {
  const { dono } = await novaBarbearia(servidor);
  const servico = (
    await dono.post('/api/servicos', { nome: 'Corte', duracao: 30, preco: 45 })
  ).corpo;
  const barbeiro = await entrarComo(dono, 'barbeiro');
  const recepcao = await entrarComo(dono, 'recepcao');
  const barbeiroNovo = async (nome, usuarioId) =>
    (
      await dono.post('/api/barbeiros', {
        nome,
        inicio: '09:00',
        fim: '19:00',
        comissao: 40,
        ...(usuarioId ? { usuarioId } : {}),
      })
    ).corpo;
  const marcos = await barbeiroNovo('Marcos', barbeiro.id);
  const leo = await barbeiroNovo('Léo');
  const cliente = (
    await recepcao.n.post('/api/clientes', {
      nome: 'Ana',
      telefone: '11911112222',
    })
  ).corpo;
  const dia = proximaSegunda();
  const agendar = async (quem, coluna, inicio) =>
    quem.n.post('/api/agendamentos', {
      data: dia,
      inicio,
      barbeiroId: coluna.id,
      servicoId: servico.id,
      clienteId: cliente.id,
    });
  const mudar = (quem, id, estado) =>
    quem.n.put(`/api/agendamentos/${id}/estado`, { estado });
  return { dia, barbeiro, recepcao, marcos, leo, agendar, mudar };
}

describe('Barbeiro ajudando na agenda', () => {
  it('vê todas as colunas e marca em qualquer uma, com autoria', async () => {
    const { dia, barbeiro, recepcao, leo, agendar } = await montada();
    const daRecepcao = await agendar(recepcao, leo, '09:00');
    const dele = await agendar(barbeiro, leo, '10:00');
    expect(dele.status).toBe(201);
    expect(dele.corpo.criadoPor).toBe(barbeiro.id);
    expect(daRecepcao.corpo.criadoPor).toBe(recepcao.id);
    const lista = (await barbeiro.n.get(`/api/agendamentos?data=${dia}`))
      .corpo;
    expect(lista.map((a) => a.id).sort()).toEqual(
      [daRecepcao.corpo.id, dele.corpo.id].sort(),
    );
  });

  it('confirma e cancela só o que marcou', async () => {
    const { barbeiro, recepcao, leo, marcos, agendar, mudar } =
      await montada();
    const deOutro = (await agendar(recepcao, leo, '09:00')).corpo;
    const naColunaDele = (await agendar(recepcao, marcos, '09:00')).corpo;
    const dele = (await agendar(barbeiro, leo, '10:00')).corpo;

    for (const estado of ['confirmado', 'cancelado']) {
      expect((await mudar(barbeiro, deOutro.id, estado)).status).toBe(403);
      expect((await mudar(barbeiro, naColunaDele.id, estado)).status).toBe(
        403,
      );
    }
    expect((await mudar(barbeiro, dele.id, 'confirmado')).status).toBe(200);
    expect((await mudar(barbeiro, dele.id, 'cancelado')).status).toBe(200);
    // Quem gerencia segue sem restrição.
    expect((await mudar(recepcao, deOutro.id, 'cancelado')).status).toBe(200);
  });

  it('marca falta na coluna dele e no que marcou; no dos outros, não', async () => {
    const { barbeiro, recepcao, leo, marcos, agendar, mudar } =
      await montada();
    const deOutro = (await agendar(recepcao, leo, '09:00')).corpo;
    const naColunaDele = (await agendar(recepcao, marcos, '09:00')).corpo;
    const dele = (await agendar(barbeiro, leo, '10:00')).corpo;
    for (const a of [deOutro, naColunaDele, dele])
      expect((await mudar(recepcao, a.id, 'confirmado')).status).toBe(200);

    expect((await mudar(barbeiro, deOutro.id, 'faltou')).status).toBe(403);
    expect((await mudar(barbeiro, naColunaDele.id, 'faltou')).status).toBe(
      200,
    );
    expect((await mudar(barbeiro, dele.id, 'faltou')).status).toBe(200);
  });

  it('bloqueia qualquer coluna e remove só os bloqueios que criou', async () => {
    const { dia, barbeiro, recepcao, leo, marcos, mudar } = await montada();
    const bloquear = (quem, coluna, inicio, fim) =>
      quem.n.post('/api/agendamentos/bloqueios', {
        data: dia,
        inicio,
        fim,
        barbeiroId: coluna.id,
        motivo: 'Almoço',
      });
    const dele = await bloquear(barbeiro, leo, '12:00', '13:00');
    expect(dele.status).toBe(201);
    expect(dele.corpo.criadoPor).toBe(barbeiro.id);
    const daRecepcao = (await bloquear(recepcao, marcos, '12:00', '13:00'))
      .corpo;

    expect((await mudar(barbeiro, daRecepcao.id, 'cancelado')).status).toBe(
      403,
    );
    expect((await mudar(barbeiro, dele.corpo.id, 'cancelado')).status).toBe(
      200,
    );
  });

  it('busca e cadastra clientes para agendar', async () => {
    const { barbeiro } = await montada();
    const novo = await barbeiro.n.post('/api/clientes', {
      nome: 'Bruno',
      telefone: '11933334444',
    });
    expect(novo.status).toBe(201);
    expect((await barbeiro.n.get('/api/clientes')).status).toBe(200);
  });
});
