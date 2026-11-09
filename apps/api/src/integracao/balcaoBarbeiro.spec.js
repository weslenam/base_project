import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarServidor, navegador, novaBarbearia, unico } from './apoio.js';

// Planejamento 0036: o Barbeiro no Balcão. Vê, faz check-in, lança avulso e
// recebe; inicia só consigo, finaliza e pausa só os próprios; desistência e
// falta na própria coluna ou no que lançou.

let servidor;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

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
  const n = navegador(servidor);
  await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
  return { n, id: r.corpo.id };
}

/** Caixa aberto, Marcos (conta do Barbeiro), Léo (sem conta) e a Recepção. */
async function montada() {
  const { dono } = await novaBarbearia(servidor);
  const corte = (
    await dono.post('/api/servicos', { nome: 'Corte', duracao: 30, preco: 45 })
  ).corpo;
  const barbeiro = await entrarComo(dono, 'barbeiro');
  const recepcao = await entrarComo(dono, 'recepcao');
  const novo = async (nome, usuarioId) =>
    (
      await dono.post('/api/barbeiros', {
        nome,
        inicio: '00:00',
        fim: '23:59',
        comissao: 40,
        ...(usuarioId ? { usuarioId } : {}),
      })
    ).corpo;
  const marcos = await novo('Marcos', barbeiro.id);
  const leo = await novo('Léo');
  expect(
    (await dono.post('/api/caixa/abrir', { valorInicial: 50 })).status,
  ).toBe(200);
  const avulso = async (quem, coluna) =>
    (
      await quem.n.post('/api/balcao/avulsos', {
        servicoId: corte.id,
        barbeiroId: coluna?.id,
        nome: 'Cliente',
      })
    ).corpo;
  const acao = (quem, id, nome, corpo) =>
    quem.n.post(`/api/atendimentos/${id}/${nome}`, corpo);
  return { barbeiro, recepcao, marcos, leo, avulso, acao };
}

describe('Barbeiro no Balcão', () => {
  it('vê o painel e lança avulso com autoria', async () => {
    const { barbeiro, avulso, leo } = await montada();
    expect((await barbeiro.n.get('/api/balcao')).status).toBe(200);
    const a = await avulso(barbeiro, leo);
    expect(a.criadoPor).toBe(barbeiro.id);
  });

  it('inicia só consigo; finaliza só os seus; recebe a comanda', async () => {
    const { barbeiro, recepcao, marcos, leo, avulso, acao } = await montada();
    const doLeo = await avulso(recepcao, leo);
    const dele = await avulso(recepcao, marcos);

    expect((await acao(barbeiro, doLeo.id, 'iniciar')).status).toBe(403);
    // Planejamento 0037: não puxa para si o cliente de um colega...
    expect(
      (await acao(barbeiro, doLeo.id, 'iniciar', { barbeiroId: marcos.id }))
        .status,
    ).toBe(403);
    // ...mas puxa o avulso sem barbeiro ("Primeiro livre").
    const livre = await avulso(recepcao, null);
    expect(
      (await acao(barbeiro, livre.id, 'iniciar', { barbeiroId: marcos.id }))
        .status,
    ).toBe(200);
    expect((await acao(barbeiro, livre.id, 'finalizar')).status).toBe(200);

    // O de Léo, iniciado pela recepção: o Barbeiro não finaliza.
    const outro = await avulso(recepcao, leo);
    expect((await acao(recepcao, outro.id, 'iniciar')).status).toBe(200);
    expect((await acao(barbeiro, outro.id, 'finalizar')).status).toBe(403);

    expect((await acao(barbeiro, dele.id, 'iniciar')).status).toBe(200);
    expect((await acao(barbeiro, dele.id, 'finalizar')).status).toBe(200);
    const { comandaId } = (await recepcao.n.get(`/api/agendamentos/${dele.id}`))
      .corpo;
    const recebida = await barbeiro.n.post(
      `/api/comandas/${comandaId}/receber`,
      {
        forma: 'dinheiro',
      },
    );
    expect(recebida.status).toBe(200);
  });

  it('desistência na coluna dele ou no que lançou; no dos outros, não', async () => {
    const { barbeiro, recepcao, marcos, leo, avulso, acao } = await montada();
    const deOutro = await avulso(recepcao, leo);
    const naColunaDele = await avulso(recepcao, marcos);
    const queLancou = await avulso(barbeiro, leo);
    expect((await acao(barbeiro, deOutro.id, 'desistir')).status).toBe(403);
    expect((await acao(barbeiro, naColunaDele.id, 'desistir')).status).toBe(
      200,
    );
    expect((await acao(barbeiro, queLancou.id, 'desistir')).status).toBe(200);
  });

  // Planejamento 0039: abrir o caixa tem permissão própria.
  it('o Barbeiro não abre o caixa; a Recepção abre', async () => {
    const { barbeiro, recepcao } = await montada();
    const abrir = (quem) =>
      quem.n.post('/api/caixa/abrir', { valorInicial: 10 });
    expect((await abrir(barbeiro)).status).toBe(403);
    // O caixa já foi aberto na montagem: a Recepção passa da permissão e
    // esbarra só no "já aberto".
    expect((await abrir(recepcao)).status).toBe(409);
  });

  it('pausa só a própria agenda', async () => {
    const { barbeiro, marcos, leo } = await montada();
    const pausar = (b) =>
      barbeiro.n.post(`/api/barbeiros/${b.id}/pausa`, { emPausa: true });
    expect((await pausar(leo)).status).toBe(403);
    expect((await pausar(marcos)).status).toBe(200);
  });
});
