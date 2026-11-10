import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso, somarDias, somarMeses } from '@barbertime/dominio';
import {
  comoSuperusuario,
  criarServidor,
  navegador,
  novaBarbearia,
  unico,
} from './apoio.ts';
import type { ServidorDeTeste } from './apoio.ts';

type Navegador = Awaited<ReturnType<typeof novaBarbearia>>['dono'];
type ComId = { id: number };

// Planejamento 0034, etapa B: pacotes e assinaturas no banco. Venda e
// renovação pelo caixa; uso na comanda conferido ao salvar e ao receber.

let servidor: ServidorDeTeste;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

const hoje = () => momentoNoFuso().data;

const ligarModulo = (barbeariaId: number) =>
  comoSuperusuario((c) =>
    c.query(
      `insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, 'pacotes', 'ativo')
       on conflict (barbearia_id, modulo) do update set estado = 'ativo'`,
      [barbeariaId],
    ),
  );

async function entrarComo(dono: Navegador, chave: string) {
  const papel = (await dono.get('/api/papeis')).corpo.find(
    (p: { chave: string }) => p.chave === chave,
  );
  const email = `${unico(chave)}@teste.dev`;
  await dono.post('/api/usuarios', {
    nome: chave,
    email,
    senha: 'senha-segura',
    papelId: papel.id,
  });
  const n = navegador(servidor);
  await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
  return n;
}

/** Barbearia com o módulo, caixa aberto, Corte, Barba, João e Ana. */
async function comPacotes({ modulo = true } = {}) {
  const b = await novaBarbearia(servidor);
  const id = b.sessao.barbearia.id;
  if (modulo) await ligarModulo(id);
  const { dono } = b;
  const servico = async (nome: string, preco: number) =>
    (await dono.post('/api/servicos', { nome, duracao: 30, preco })).corpo;
  const corte = await servico('Corte', 50);
  const barba = await servico('Barba', 30);
  const joao = (
    await dono.post('/api/barbeiros', {
      nome: 'João',
      inicio: '00:00',
      fim: '23:59',
      comissao: 40,
    })
  ).corpo;
  const ana = (
    await dono.post('/api/clientes', { nome: 'Ana', telefone: '11955554444' })
  ).corpo;
  await dono.post('/api/caixa/abrir', { valorInicial: 0 });

  const criarPacote = async (dados: object = {}) =>
    dono.post('/api/pacotes', {
      nome: 'Clube',
      preco: 120,
      tipo: 'recorrente',
      itens: [{ servicoId: corte.id, quantidade: null }],
      ...dados,
    });
  const vender = async (pacote: ComId, quem = dono, clienteId = ana.id) =>
    quem.post('/api/assinaturas', {
      clienteId,
      pacoteId: pacote.id,
      barbeiroId: joao.id,
    });
  const receber = (comandaId: number, quem = dono) =>
    quem.post(`/api/comandas/${comandaId}/receber`, { forma: 'pix' });
  /** Vende e paga: devolve a assinatura ativa. */
  const assinar = async (pacote: ComId) => {
    const v = await vender(pacote);
    expect(v.status).toBe(201);
    expect((await receber(v.corpo.comandaId)).status).toBe(200);
    return (await assinaturas()).find(
      (a: ComId) => a.id === v.corpo.assinatura.id,
    );
  };
  const assinaturas = async (clienteId = ana.id) =>
    (await dono.get(`/api/clientes/${clienteId}/assinaturas`)).corpo;
  const usar = (assinatura: ComId, servicoId = corte.id, quem = dono) =>
    quem.post('/api/comandas', {
      barbeiroId: joao.id,
      clienteId: ana.id,
      itens: [
        { tipo: 'servico', refId: servicoId, assinaturaId: assinatura.id },
      ],
    });
  return {
    ...b,
    id,
    corte,
    barba,
    joao,
    ana,
    criarPacote,
    vender,
    receber,
    assinar,
    assinaturas,
    usar,
  };
}

describe('cadastro de pacotes', () => {
  it('persiste, valida, recusa nome repetido e exige o módulo', async () => {
    const b = await comPacotes();
    const r = await b.criarPacote({
      nome: '4 barbas',
      preco: 100,
      tipo: 'unico',
      validadeDias: 60,
      itens: [{ servicoId: b.barba.id, quantidade: 4 }],
      limites: { intervaloMinimoDias: 5 },
    });
    expect(r.status).toBe(201);
    const lista = (await b.dono.get('/api/pacotes')).corpo;
    expect(lista).toEqual([
      expect.objectContaining({
        nome: '4 barbas',
        preco: 100,
        tipo: 'unico',
        validadeDias: 60,
        itens: [{ servicoId: b.barba.id, servicoNome: 'Barba', quantidade: 4 }],
        limites: { intervaloMinimoDias: 5, maximoPorSemana: null },
      }),
    ]);

    expect((await b.criarPacote({ nome: '4 BARBAS' })).status).toBe(409);
    expect((await b.criarPacote({ itens: [] })).status).toBe(400);
    expect((await b.criarPacote({ preco: 0 })).status).toBe(400);

    // Serviço de outra barbearia não entra (a RLS esconde).
    const outra = await comPacotes();
    expect(
      (await b.criarPacote({ itens: [{ servicoId: outra.corte.id }] })).status,
    ).toBe(400);

    const semModulo = await comPacotes({ modulo: false });
    expect((await semModulo.dono.get('/api/pacotes')).status).toBe(403);
  });

  it('editar muda para quem já comprou; excluir é recusado com pacote em vigor', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const a = await b.assinar(pacote);
    const editado = await b.dono.put(`/api/pacotes/${pacote.id}`, {
      ...pacote,
      nome: 'Clube VIP',
      preco: 150,
    });
    expect(editado.status).toBe(200);
    const [depois] = await b.assinaturas();
    expect(depois.id).toBe(a.id);
    expect(depois.pacote.nome).toBe('Clube VIP');

    const ex = await b.dono.delete(`/api/pacotes/${pacote.id}`);
    expect(ex.status).toBe(409);
    expect(ex.corpo.mensagem).toMatch(/1 cliente/);

    const livre = (await b.criarPacote({ nome: 'Sem clientes' })).corpo;
    expect((await b.dono.delete(`/api/pacotes/${livre.id}`)).status).toBe(204);
    expect(
      (await b.dono.get('/api/pacotes')).corpo.map(
        (p: { nome: string }) => p.nome,
      ),
    ).toEqual(['Clube VIP']);
  });
});

describe('venda', () => {
  it('entra no caixa e o pacote vale quando a comanda é paga', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const v = await b.vender(pacote);
    expect(v.status).toBe(201);
    expect(v.corpo.assinatura).toMatchObject({
      estado: 'aguardando_pagamento',
      vigente: false,
    });
    const cm = (await b.dono.get(`/api/comandas/${v.corpo.comandaId}`)).corpo;
    expect(cm.itens).toEqual([
      expect.objectContaining({
        tipo: 'pacote',
        nome: 'Pacote: Clube',
        preco: 120,
      }),
    ]);
    expect(cm.total).toBe(120);

    expect((await b.receber(cm.id)).status).toBe(200);
    const [a] = await b.assinaturas();
    expect(a).toMatchObject({
      estado: 'ativa',
      vigente: true,
      inicio: hoje(),
      fim: somarDias(somarMeses(hoje(), 1), -1),
    });
    const caixa = (await b.dono.get('/api/caixa')).corpo;
    expect(caixa.resumo.totalRecebido).toBe(120);
  });

  it('cancelar a comanda cancela a venda', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const v = await b.vender(pacote);
    await b.dono.post(`/api/comandas/${v.corpo.comandaId}/cancelar`);
    expect(await b.assinaturas()).toEqual([]);
  });

  it('o Barbeiro não vende, mas usa o pacote na comanda e recebe', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const a = await b.assinar(pacote);
    const barbeiro = await entrarComo(b.dono, 'barbeiro');
    expect((await b.vender(pacote, barbeiro)).status).toBe(403);
    expect(
      (await barbeiro.post(`/api/assinaturas/${a.id}/renovar`, {})).status,
    ).toBe(403);
    expect(
      (await barbeiro.get(`/api/clientes/${b.ana.id}/assinaturas`)).status,
    ).toBe(200);
    const cm = await b.usar(a, b.corte.id, barbeiro);
    expect(cm.status).toBe(201);
    expect((await b.receber(cm.corpo.id, barbeiro)).status).toBe(200);
  });

  it('a RLS isola: outra barbearia não vê nem vende o pacote', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const a = await b.assinar(pacote);
    const outra = await comPacotes();
    expect((await outra.vender(pacote)).status).toBe(404);
    expect(
      (await outra.dono.get(`/api/clientes/${b.ana.id}/assinaturas`)).status,
    ).toBe(404);
    expect((await outra.usar(a)).status).toBe(404);
  });
});

describe('#22: item de pacote só pela venda', () => {
  it('#22: comanda comum não aceita item de pacote; a venda pendente não perde o item nem troca o cliente', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const avulso = await b.dono.post('/api/comandas', {
      barbeiroId: b.joao.id,
      clienteId: b.ana.id,
      itens: [{ tipo: 'pacote', refId: pacote.id }],
    });
    expect(avulso.status).toBe(400);
    expect(avulso.corpo.mensagem).toMatch(/só pela venda/);
    // Sem refId também é 400, não 500.
    const semRef = await b.dono.post('/api/comandas', {
      barbeiroId: b.joao.id,
      itens: [{ tipo: 'pacote' }],
    });
    expect(semRef.status).toBe(400);

    const v = (await b.vender(pacote)).corpo;
    const cm = (await b.dono.get(`/api/comandas/${v.comandaId}`)).corpo;
    // Salvar de novo com o item mantém o preço da venda e aceita mais itens.
    const mais = await b.dono.put(`/api/comandas/${cm.id}`, {
      clienteId: b.ana.id,
      itens: [...cm.itens, { tipo: 'servico', refId: b.corte.id }],
    });
    expect(mais.status).toBe(200);
    expect(mais.corpo.total).toBe(170);
    // Tirar o item ou trocar o cliente é recusado ao salvar.
    const semItem = await b.dono.put(`/api/comandas/${cm.id}`, {
      clienteId: b.ana.id,
      itens: [{ tipo: 'servico', refId: b.corte.id }],
    });
    expect(semItem.status).toBe(400);
    expect(semItem.corpo.mensagem).toMatch(/cancele a comanda/);
    const bia = (
      await b.dono.post('/api/clientes', {
        nome: 'Bia',
        telefone: '11944443333',
      })
    ).corpo;
    const outroCliente = await b.dono.put(`/api/comandas/${cm.id}`, {
      clienteId: bia.id,
      itens: cm.itens,
    });
    expect(outroCliente.status).toBe(400);
  });

  it('o pacote mostra a data da renovação e o ciclo a começar, na data da barbearia', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const a = await b.assinar(pacote);
    expect(a.renovaEm).toBe(somarDias(a.fim, 1));
    expect(a.aComecar).toBe(false);
  });
});

describe('uso na comanda', () => {
  it('sai a R$ 0, grava ao receber e respeita a quantidade', async () => {
    const b = await comPacotes();
    const pacote = (
      await b.criarPacote({
        nome: '1 corte',
        tipo: 'unico',
        validadeDias: 30,
        itens: [{ servicoId: b.corte.id, quantidade: 1 }],
      })
    ).corpo;
    const a = await b.assinar(pacote);
    const ok = await b.dono.post(`/api/assinaturas/${a.id}/pode-usar`, {
      servicoId: b.corte.id,
    });
    expect(ok.corpo).toEqual({ ok: true });

    const cm = await b.usar(a);
    expect(cm.status).toBe(201);
    expect(cm.corpo.itens[0]).toMatchObject({
      preco: 0,
      assinaturaId: a.id,
      nome: 'Corte (pacote)',
    });
    expect(cm.corpo.total).toBe(0);
    expect((await b.receber(cm.corpo.id)).status).toBe(200);
    const [depois] = await b.assinaturas();
    expect(depois.saldo).toEqual([
      expect.objectContaining({ quantidade: 1, usados: 1, restantes: 0 }),
    ]);

    const de_novo = await b.usar(a);
    expect(de_novo.status).toBe(400);
    expect(de_novo.corpo.mensagem).toMatch(/já foram usados/);
    // Serviço fora do pacote também é recusado.
    expect((await b.usar(a, b.barba.id)).status).toBe(400);
  });

  it('dois recebimentos ao mesmo tempo não gastam o mesmo uso duas vezes', async () => {
    const b = await comPacotes();
    const pacote = (
      await b.criarPacote({
        nome: '1 corte',
        tipo: 'unico',
        validadeDias: 30,
        itens: [{ servicoId: b.corte.id, quantidade: 1 }],
      })
    ).corpo;
    const a = await b.assinar(pacote);
    const um = (await b.usar(a)).corpo;
    const dois = (await b.usar(a)).corpo;
    const [r1, r2] = await Promise.all([b.receber(um.id), b.receber(dois.id)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 400]);
    const [depois] = await b.assinaturas();
    expect(depois.usos).toHaveLength(1);
  });

  it('pacote de outro cliente, a pagar ou sem o módulo é recusado', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const a = await b.assinar(pacote);
    const bia = (
      await b.dono.post('/api/clientes', {
        nome: 'Bia',
        telefone: '11944443333',
      })
    ).corpo;
    const deOutro = await b.dono.post('/api/comandas', {
      barbeiroId: b.joao.id,
      clienteId: bia.id,
      itens: [{ tipo: 'servico', refId: b.corte.id, assinaturaId: a.id }],
    });
    expect(deOutro.status).toBe(400);
    expect(deOutro.corpo.mensagem).toMatch(/outro cliente/);

    const aPagar = (await b.vender(pacote)).corpo.assinatura;
    expect((await b.usar(aPagar)).status).toBe(400);

    await comoSuperusuario((c) =>
      c.query(
        "update barbearia_modulos set estado = 'inativo' where barbearia_id = $1 and modulo = 'pacotes'",
        [b.id],
      ),
    );
    expect((await b.usar(a)).status).toBe(400);
    expect((await b.dono.get('/api/pacotes')).status).toBe(403);
  });
});

describe('renovação', () => {
  it('em vigor: o novo ciclo começa depois do fim; uma renovação por vez', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const a = await b.assinar(pacote);
    const r = await b.dono.post(`/api/assinaturas/${a.id}/renovar`, {
      barbeiroId: b.joao.id,
    });
    expect(r.status).toBe(201);
    const cm = (await b.dono.get(`/api/comandas/${r.corpo.comandaId}`)).corpo;
    expect(cm.total).toBe(120);

    const pendente = (await b.assinaturas()).find((x: ComId) => x.id === a.id);
    expect(pendente.renovacao).toBe('aguardando_pagamento');
    const outra = await b.dono.post(`/api/assinaturas/${a.id}/renovar`, {
      barbeiroId: b.joao.id,
    });
    expect(outra.status).toBe(409);

    expect((await b.receber(r.corpo.comandaId)).status).toBe(200);
    const nova = (await b.assinaturas()).find(
      (x: ComId) => x.id === r.corpo.assinatura.id,
    );
    const inicio = somarDias(a.fim, 1);
    expect(nova).toMatchObject({
      estado: 'ativa',
      inicio,
      fim: somarDias(somarMeses(inicio, 1), -1),
      vigente: false,
    });
    // O ciclo atual continua valendo até o fim.
    expect(
      (await b.assinaturas()).find((x: ComId) => x.id === a.id).vigente,
    ).toBe(true);
    expect(
      (
        await b.dono.post(`/api/assinaturas/${a.id}/renovar`, {
          barbeiroId: b.joao.id,
        })
      ).corpo.mensagem,
    ).toMatch(/já foi renovado/);
  });

  it('vencido começa no pagamento; pacote de compra única não renova', async () => {
    const b = await comPacotes();
    const pacote = (await b.criarPacote()).corpo;
    const a = await b.assinar(pacote);
    await comoSuperusuario((c) =>
      c.query('update assinaturas set inicio = $2, fim = $3 where id = $1', [
        a.id,
        somarDias(hoje(), -40),
        somarDias(hoje(), -10),
      ]),
    );
    const r = await b.dono.post(`/api/assinaturas/${a.id}/renovar`, {
      barbeiroId: b.joao.id,
    });
    await b.receber(r.corpo.comandaId);
    const nova = (await b.assinaturas()).find(
      (x: ComId) => x.id === r.corpo.assinatura.id,
    );
    expect(nova).toMatchObject({ inicio: hoje(), vigente: true });

    const unico = (
      await b.criarPacote({ nome: 'Único', tipo: 'unico', validadeDias: 30 })
    ).corpo;
    const u = await b.assinar(unico);
    const nao = await b.dono.post(`/api/assinaturas/${u.id}/renovar`, {
      barbeiroId: b.joao.id,
    });
    expect(nao.status).toBe(409);
    expect(nao.corpo.mensagem).toMatch(/Só o pacote mensal/);
  });
});
