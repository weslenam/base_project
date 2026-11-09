import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso, somarMeses } from '@barbertime/dominio';
import { comoSuperusuario, criarServidor, novaBarbearia } from './apoio.js';

// Planejamento 0034, etapa A: fidelidade no banco, com crédito ao receber a
// comanda e resgate (prêmio e cashback) na comanda.

let servidor;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

const hoje = () => momentoNoFuso().data;

const ligarModulo = (barbeariaId, modulo = 'fidelidade') =>
  comoSuperusuario((c) =>
    c.query(
      `insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, $2, 'ativo')
       on conflict (barbearia_id, modulo) do update set estado = 'ativo'`,
      [barbeariaId, modulo],
    ),
  );

/** Barbearia com fidelidade ligada (10 selos, Corte de prêmio, 5% de cashback). */
async function comFidelidade({ modulo = true } = {}) {
  const b = await novaBarbearia(servidor);
  const id = b.sessao.barbearia.id;
  if (modulo) await ligarModulo(id);
  const { dono } = b;
  const corte = (
    await dono.post('/api/servicos', { nome: 'Corte', duracao: 30, preco: 50 })
  ).corpo;
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
  if (modulo)
    expect(
      (
        await dono.put('/api/fidelidade/config', {
          selos: { ativo: true, necessarios: 10, premioServicoId: corte.id },
          cashback: { ativo: true, percentual: 5, validadeDias: 90 },
        })
      ).status,
    ).toBe(200);
  const comanda = async (extra = {}) =>
    dono.post('/api/comandas', {
      barbeiroId: joao.id,
      clienteId: ana.id,
      itens: [{ tipo: 'servico', refId: corte.id }],
      ...extra,
    });
  const receber = (cm) =>
    dono.post(`/api/comandas/${cm.id}/receber`, { forma: 'pix' });
  const fidelidadeDe = async (clienteId = ana.id) =>
    (await dono.get(`/api/clientes/${clienteId}/fidelidade`)).corpo;
  const darSelos = (n) =>
    comoSuperusuario(async (c) => {
      for (let i = 0; i < n; i++)
        await c.query(
          `insert into fidelidade_movimentos (barbearia_id, cliente_id, tipo, valor, data, expira_em)
           values ($1, $2, 'selo', 1, $3, null)`,
          [id, ana.id, hoje()],
        );
    });
  return {
    ...b,
    id,
    corte,
    joao,
    ana,
    comanda,
    receber,
    fidelidadeDe,
    darSelos,
  };
}

describe('configuração', () => {
  it('persiste, valida e exige o módulo', async () => {
    const b = await comFidelidade();
    const config = (await b.dono.get('/api/fidelidade/config')).corpo;
    expect(config.selos).toMatchObject({
      ativo: true,
      necessarios: 10,
      premioServicoId: b.corte.id,
    });
    expect(config.cashback).toMatchObject({ ativo: true, percentual: 5 });

    const ruim = await b.dono.put('/api/fidelidade/config', {
      selos: { ativo: true, necessarios: 1, premioServicoId: b.corte.id },
      cashback: { ativo: false },
    });
    expect(ruim.status).toBe(400);

    // Serviço de outra barbearia não serve de prêmio (a RLS esconde).
    const outra = await comFidelidade();
    const deFora = await b.dono.put('/api/fidelidade/config', {
      selos: { ativo: true, necessarios: 5, premioServicoId: outra.corte.id },
      cashback: { ativo: false },
    });
    expect(deFora.status).toBe(400);
    expect(deFora.corpo.mensagem).toMatch(/prêmio não encontrado/);

    const semModulo = await comFidelidade({ modulo: false });
    expect((await semModulo.dono.get('/api/fidelidade/config')).status).toBe(
      403,
    );
  });
});

describe('crédito ao receber a comanda', () => {
  it('cliente identificado ganha selo e cashback; avulso não ganha', async () => {
    const b = await comFidelidade();
    const cm = (await b.comanda()).corpo;
    const paga = await b.receber(cm);
    expect(paga.status).toBe(200);
    expect(paga.corpo.creditos).toEqual([
      { tipo: 'selo', valor: 1 },
      { tipo: 'cashback', valor: 2.5 },
    ]);
    const { saldo, extrato } = await b.fidelidadeDe();
    expect(saldo).toMatchObject({ selos: 1, cashback: 2.5, necessarios: 10 });
    expect(extrato).toHaveLength(2);
    expect(extrato.find((m) => m.tipo === 'selo').expiraEm).toBeNull();

    const avulsa = (await b.comanda({ clienteId: null })).corpo;
    expect((await b.receber(avulsa)).corpo.creditos).toEqual([]);
    expect((await b.fidelidadeDe()).saldo.selos).toBe(1);
  });

  it('validade dos selos e do cashback vem da configuração', async () => {
    const b = await comFidelidade();
    await b.dono.put('/api/fidelidade/config', {
      selos: {
        ativo: true,
        necessarios: 10,
        premioServicoId: b.corte.id,
        validadeMeses: 6,
      },
      cashback: { ativo: true, percentual: 10, validadeDias: 30 },
    });
    await b.receber((await b.comanda()).corpo);
    const { extrato } = await b.fidelidadeDe();
    expect(extrato.find((m) => m.tipo === 'selo').expiraEm).toBe(
      somarMeses(hoje(), 6),
    );
    expect(extrato.find((m) => m.tipo === 'cashback').valor).toBe(5);
  });
});

describe('resgate na comanda', () => {
  it('prêmio: serviço a R$ 0 montado pelo servidor e gasta os selos', async () => {
    const b = await comFidelidade();
    expect((await b.comanda({ premioFidelidade: true })).status).toBe(400);

    await b.darSelos(10);
    const r = await b.comanda({ itens: [], premioFidelidade: true });
    expect(r.status).toBe(201);
    const premio = r.corpo.itens.find((i) => i.premio);
    expect(premio).toMatchObject({
      refId: b.corte.id,
      preco: 0,
      nome: 'Corte',
    });
    expect(r.corpo.total).toBe(0);

    const paga = await b.receber(r.corpo);
    expect(paga.status).toBe(200);
    // O prêmio a R$ 0 não rende selo nem cashback.
    expect(paga.corpo.creditos).toEqual([]);
    expect((await b.fidelidadeDe()).saldo.selos).toBe(0);
  });

  it('o preço do prêmio não vem de quem chama a API', async () => {
    const b = await comFidelidade();
    await b.darSelos(10);
    const r = await b.comanda({
      itens: [{ tipo: 'servico', refId: b.corte.id, preco: 0, premio: true }],
    });
    // Sem premioFidelidade, o item "prêmio" enviado é ignorado.
    expect(r.corpo.itens).toEqual([]);
  });

  it('cashback: abate do total, rende cashback só sobre o que foi pago', async () => {
    const b = await comFidelidade();
    await b.receber((await b.comanda()).corpo); // +2,50
    expect((await b.comanda({ cashbackUsado: 3 })).corpo.mensagem).toMatch(
      /não tem esse saldo/,
    );

    const cm = (await b.comanda({ cashbackUsado: 2 })).corpo;
    expect(cm).toMatchObject({ cashbackUsado: 2, cashback: 2, total: 48 });
    const paga = await b.receber(cm);
    expect(paga.corpo.creditos).toContainEqual({
      tipo: 'cashback',
      valor: 2.4,
    });
    expect((await b.fidelidadeDe()).saldo.cashback).toBe(2.9);

    // O caixa só conta o dinheiro que entrou (50 + 48).
    const caixa = (await b.dono.get('/api/caixa')).corpo;
    expect(caixa.resumo.totalRecebido).toBe(98);
  });

  it('o mesmo saldo não é gasto duas vezes em recebimentos simultâneos', async () => {
    const b = await comFidelidade();
    await b.receber((await b.comanda()).corpo); // +2,50
    const um = (await b.comanda({ cashbackUsado: 2.5 })).corpo;
    const dois = (await b.comanda({ cashbackUsado: 2.5 })).corpo;
    const [r1, r2] = await Promise.all([b.receber(um), b.receber(dois)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const { saldo, extrato } = await b.fidelidadeDe();
    expect(extrato.filter((m) => m.tipo === 'uso_cashback')).toHaveLength(1);
    expect(saldo.cashback).toBeGreaterThanOrEqual(0);
  });

  it('sem o módulo, a comanda recusa o resgate', async () => {
    const b = await comFidelidade({ modulo: false });
    const r = await b.comanda({ cashbackUsado: 1 });
    expect(r.status).toBe(400);
    expect(r.corpo.mensagem).toMatch(/Fidelidade não está ativo/);
    // E a comanda comum segue sem crédito nenhum.
    const cm = (await b.comanda()).corpo;
    expect((await b.receber(cm)).corpo.creditos).toEqual([]);
  });
});

describe('isolamento', () => {
  it('uma barbearia não vê o extrato de cliente da outra', async () => {
    const a = await comFidelidade();
    await a.receber((await a.comanda()).corpo);
    const b = await comFidelidade();
    const r = await b.dono.get(`/api/clientes/${a.ana.id}/fidelidade`);
    expect(r.status).toBe(200);
    expect(r.corpo.extrato).toEqual([]);
    expect(r.corpo.saldo.selos).toBe(0);
  });
});
