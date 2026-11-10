import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso, paraHora, paraMinutos } from '@barbertime/dominio';
import { criarServidor, novaBarbearia } from './apoio.ts';
import type { ServidorDeTeste } from './apoio.ts';

type ComId = { id: number };

// Planejamento 0020 (fase 1): Balcão, caixa e comandas ligadas ao atendimento.

let servidor: ServidorDeTeste;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

const agora = () => momentoNoFuso();
const daqui = (min: number) =>
  paraHora(Math.min(23 * 60 + 30, paraMinutos(agora().hora) + min));

/** Barbearia com caixa aberto, um serviço de 30 min e dois barbeiros o dia todo. */
async function balcao() {
  const b = await novaBarbearia(servidor);
  const corte = (
    await b.dono.post('/api/servicos', {
      nome: 'Corte',
      duracao: 30,
      preco: 45,
    })
  ).corpo;
  const joao = (
    await b.dono.post('/api/barbeiros', {
      nome: 'João',
      inicio: '00:00',
      fim: '23:59',
      comissao: 40,
    })
  ).corpo;
  const leo = (
    await b.dono.post('/api/barbeiros', {
      nome: 'Léo',
      inicio: '00:00',
      fim: '23:59',
      comissao: 40,
    })
  ).corpo;
  expect(
    (await b.dono.post('/api/caixa/abrir', { valorInicial: 50 })).status,
  ).toBe(200);
  return { ...b, corte, joao, leo };
}

describe('caixa e comandas no banco', () => {
  it('abre, lança, recebe e fecha com o resumo por forma', async () => {
    const { dono, corte, joao } = await balcao();
    const cm = (
      await dono.post('/api/comandas', {
        barbeiroId: joao.id,
        itens: [{ tipo: 'servico', refId: corte.id }],
      })
    ).corpo;
    expect(cm).toMatchObject({
      estado: 'aberta',
      total: 45,
      clienteNome: 'Cliente avulso',
    });
    const fechar = await dono.post('/api/caixa/fechar', {
      dinheiroContado: 95,
    });
    expect(fechar.status).toBe(409);
    const pago = (
      await dono.post(`/api/comandas/${cm.id}/receber`, { forma: 'dinheiro' })
    ).corpo;
    expect(pago.estado).toBe('paga');
    const caixa = (
      await dono.post('/api/caixa/fechar', { dinheiroContado: 95 })
    ).corpo;
    expect(caixa).toMatchObject({ aberto: false, diferenca: 0 });
    expect(caixa.resumo.dinheiroEsperado).toBe(95);
  });
});

describe('balcão', () => {
  it('avulso em 3 toques: entra na fila com comanda aberta; pode começar agora', async () => {
    const { dono, corte } = await balcao();
    const r = await dono.post('/api/balcao/avulsos', {
      servicoId: corte.id,
      barbeiroId: null,
    });
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({
      status: 'na_fila',
      origem: 'avulso',
      clienteNome: 'Cliente balcão',
    });
    expect(r.corpo.comandaId).toEqual(expect.any(Number));
    const painel = (await dono.get('/api/balcao')).corpo;
    expect(painel.fila).toHaveLength(1);
    expect(painel.fila[0]).toMatchObject({ podeAgora: true, esperaMin: 0 });
  });

  it('com WhatsApp: reaproveita o cliente pelo telefone', async () => {
    const { dono, corte } = await balcao();
    await dono.post('/api/clientes', {
      nome: 'Rafael Souza',
      telefone: '11987654321',
    });
    const r = await dono.post('/api/balcao/avulsos', {
      servicoId: corte.id,
      telefone: '11987654321',
    });
    expect(r.corpo.clienteNome).toBe('Rafael Souza');
  });

  it('ciclo completo: iniciar → finalizar → receber deixa o atendimento pago', async () => {
    const { dono, corte, joao } = await balcao();
    const a = (await dono.post('/api/balcao/avulsos', { servicoId: corte.id }))
      .corpo;
    const ini = await dono.post(`/api/atendimentos/${a.id}/iniciar`, {
      barbeiroId: joao.id,
    });
    expect(ini.corpo).toMatchObject({
      status: 'em_atendimento',
      barbeiroNome: 'João',
    });
    expect(
      (await dono.post(`/api/atendimentos/${a.id}/iniciar`, {})).status,
    ).toBe(409);
    const painel = (await dono.get('/api/balcao')).corpo;
    expect(painel.barbeiros.find((b: ComId) => b.id === joao.id)).toMatchObject(
      {
        estado: 'ocupado',
        restanteMin: 30,
      },
    );

    expect(
      (await dono.post(`/api/atendimentos/${a.id}/finalizar`)).corpo.status,
    ).toBe('finalizado');
    expect((await dono.get('/api/balcao')).corpo.aCobrar).toHaveLength(1);
    await dono.post(`/api/comandas/${a.comandaId}/receber`, { forma: 'pix' });
    const fim = (
      await dono.get(`/api/agendamentos?data=${agora().data}`)
    ).corpo.find((x: ComId) => x.id === a.id);
    expect(fim).toMatchObject({ status: 'pago', estado: 'atendido' });
  });

  it('o avulso não atropela quem agendou', async () => {
    const { dono, corte, joao, leo } = await balcao();
    const cli = (
      await dono.post('/api/clientes', {
        nome: 'Carlos',
        telefone: '11955554444',
      })
    ).corpo;
    // João tem agendado daqui a 20 min: um corte de 30 não cabe.
    await dono.post('/api/agendamentos', {
      data: agora().data,
      inicio: daqui(20),
      barbeiroId: joao.id,
      servicoId: corte.id,
      clienteId: cli.id,
    });
    const enc = (await dono.get(`/api/balcao/encaixe?servicoId=${corte.id}`))
      .corpo;
    expect(
      enc.porBarbeiro.find(
        (p: { barbeiroId: number }) => p.barbeiroId === joao.id,
      ).podeAgora,
    ).toBe(false);
    expect(enc.primeiroLivre.barbeiroId).toBe(leo.id);

    const a = (await dono.post('/api/balcao/avulsos', { servicoId: corte.id }))
      .corpo;
    const r = await dono.post(`/api/atendimentos/${a.id}/iniciar`, {
      barbeiroId: joao.id,
    });
    expect(r.status).toBe(409);
    expect(r.corpo.mensagem).toContain('atropela o agendamento');
    expect(
      (
        await dono.post(`/api/atendimentos/${a.id}/iniciar`, {
          barbeiroId: leo.id,
        })
      ).status,
    ).toBe(200);
  });

  it('check-in do agendado abre a comanda e coloca à frente da fila', async () => {
    const { dono, corte, joao } = await balcao();
    const avulso = (
      await dono.post('/api/balcao/avulsos', { servicoId: corte.id })
    ).corpo;
    const cli = (
      await dono.post('/api/clientes', { nome: 'Ana', telefone: '11911112222' })
    ).corpo;
    const ag = (
      await dono.post('/api/agendamentos', {
        data: agora().data,
        inicio: daqui(60),
        barbeiroId: joao.id,
        servicoId: corte.id,
        clienteId: cli.id,
      })
    ).corpo;
    expect(
      (await dono.get('/api/balcao')).corpo.proximos.map((p: ComId) => p.id),
    ).toContain(ag.id);
    const ci = (await dono.post(`/api/atendimentos/${ag.id}/checkin`)).corpo;
    expect(ci).toMatchObject({ status: 'chegou', comandaEstado: 'aberta' });
    const fila = (await dono.get('/api/balcao')).corpo.fila.map(
      (f: ComId) => f.id,
    );
    expect(fila).toEqual([ag.id, avulso.id]);
  });

  it('desistência cancela a comanda; pausa tira o barbeiro da sugestão', async () => {
    const { dono, corte, joao, leo } = await balcao();
    const a = (await dono.post('/api/balcao/avulsos', { servicoId: corte.id }))
      .corpo;
    expect(
      (await dono.post(`/api/atendimentos/${a.id}/desistir`)).corpo,
    ).toMatchObject({
      status: 'desistiu',
      comandaEstado: 'cancelada',
    });
    await dono.post(`/api/barbeiros/${leo.id}/pausa`, { emPausa: true });
    const enc = (await dono.get(`/api/balcao/encaixe?servicoId=${corte.id}`))
      .corpo;
    expect(
      enc.porBarbeiro.find(
        (p: { barbeiroId: number }) => p.barbeiroId === leo.id,
      ).estado,
    ).toBe('pausa');
    expect(enc.primeiroLivre.barbeiroId).toBe(joao.id);
  });

  it('sem caixa aberto, não registra avulso', async () => {
    const b = await novaBarbearia(servidor);
    const s = (
      await b.dono.post('/api/servicos', {
        nome: 'Corte',
        duracao: 30,
        preco: 45,
      })
    ).corpo;
    const r = await b.dono.post('/api/balcao/avulsos', { servicoId: s.id });
    expect(r.status).toBe(409);
    expect(r.corpo.mensagem).toContain('Abra o caixa');
  });
});
