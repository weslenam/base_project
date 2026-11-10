import {
  resumoDeComandas,
  diferencaDeCaixa,
  FORMAS_DE_PAGAMENTO,
  motivoParaNaoReceber,
  resumoDoCaixa,
  totalDaComanda,
} from './caixa.ts';

const itens = [
  { preco: 45, quantidade: 1 },
  { preco: 39.9, quantidade: 2 },
];

describe('totalDaComanda', () => {
  it('soma itens com quantidade e aplica desconto, sem erro de centavos', () => {
    expect(totalDaComanda({ itens, desconto: 4.8 })).toEqual({
      servicos: 124.8,
      produtos: 0,
      subtotal: 124.8,
      desconto: 4.8,
      cashback: 0,
      total: 120,
    });
    expect(
      totalDaComanda({ itens: [{ preco: 0.1 }, { preco: 0.2 }] }).total,
    ).toBe(0.3);
  });

  it('separa total em serviços e em produtos; somados dão o subtotal', () => {
    const t = totalDaComanda({
      itens: [
        { tipo: 'servico', preco: 30 },
        { tipo: 'produto', preco: 34.9 },
        { tipo: 'produto', preco: 44.9, quantidade: 2 },
      ],
      desconto: 4.7,
    });
    expect(t).toEqual({
      servicos: 30,
      produtos: 124.7,
      subtotal: 154.7,
      desconto: 4.7,
      cashback: 0,
      total: 150,
    });
  });

  it('total nunca fica negativo', () => {
    expect(totalDaComanda({ itens: [{ preco: 10 }], desconto: 50 }).total).toBe(
      0,
    );
  });
});

describe('motivoParaNaoReceber', () => {
  it.each([
    [{ itens: [], forma: 'pix' }, 'pelo menos um'],
    [{ itens, desconto: 200, forma: 'pix' }, 'desconto não pode'],
    [{ itens, forma: undefined }, 'forma de pagamento'],
  ])('%o → recusa', (comanda, trecho) => {
    expect(motivoParaNaoReceber(comanda)).toContain(trecho);
  });

  it('comanda completa pode ser recebida', () => {
    expect(
      motivoParaNaoReceber({ itens, desconto: 10, forma: 'dinheiro' }),
    ).toBeNull();
  });
});

describe('resumoDoCaixa', () => {
  const comandas = [
    { estado: 'paga', forma: 'dinheiro', itens: [{ preco: 45 }], desconto: 0 },
    {
      estado: 'paga',
      forma: 'pix',
      itens: [{ preco: 70 }, { preco: 39.9 }],
      desconto: 9.9,
    },
    { estado: 'paga', forma: 'dinheiro', itens: [{ preco: 30 }], desconto: 0 },
    { estado: 'aberta', forma: null, itens: [{ preco: 45 }], desconto: 0 },
    {
      estado: 'cancelada',
      forma: 'credito',
      itens: [{ preco: 60 }],
      desconto: 0,
    },
  ];

  it('soma só as pagas, por forma, e o total bate com a soma das formas', () => {
    const r = resumoDoCaixa({ valorInicial: 100, comandas });
    expect(r.porForma).toEqual({
      dinheiro: 75,
      pix: 100,
      debito: 0,
      credito: 0,
    });
    expect(r.totalRecebido).toBe(175);
    expect(Object.values(r.porForma).reduce((a, b) => a + b, 0)).toBe(
      r.totalRecebido,
    );
    expect(r).toMatchObject({ dinheiroEsperado: 175, pagas: 3, abertas: 1 });
  });

  // Planejamento 0037: R$50 com R$10 de cashback e R$40 em dinheiro.
  it('cashback abate como desconto: fora da gaveta, numa linha própria', () => {
    const r = resumoDoCaixa({
      valorInicial: 0,
      comandas: [
        {
          estado: 'paga',
          forma: 'dinheiro',
          itens: [{ preco: 50 }],
          desconto: 0,
          cashbackUsado: 10,
        },
      ],
    });
    expect(r).toMatchObject({
      totalRecebido: 40,
      dinheiroEsperado: 40,
      cashback: 10,
    });
    expect(r.porForma.dinheiro).toBe(40);
  });

  it('tem uma entrada para cada forma de pagamento', () => {
    expect(Object.keys(resumoDoCaixa({}).porForma)).toEqual(
      FORMAS_DE_PAGAMENTO.map((f) => f.valor),
    );
  });
});

describe('diferencaDeCaixa', () => {
  it('positivo é sobra, negativo é falta', () => {
    expect(diferencaDeCaixa(180.5, 175)).toBe(5.5);
    expect(diferencaDeCaixa(170, 175)).toBe(-5);
    expect(diferencaDeCaixa(175, 175)).toBe(0);
  });
});

describe('resumoDeComandas', () => {
  const comandas = [
    {
      estado: 'paga',
      data: '2026-10-24',
      hora: '10:00',
      barbeiroId: 1,
      desconto: 0,
      itens: [{ tipo: 'servico', nome: 'Corte + barba', preco: 70 }],
    },
    {
      estado: 'paga',
      data: '2026-10-31',
      hora: '15:00',
      barbeiroId: 2,
      desconto: 4.9,
      itens: [
        { tipo: 'servico', nome: 'Corte', preco: 45 },
        { tipo: 'produto', nome: 'Pomada', preco: 39.9 },
      ],
    },
    {
      estado: 'paga',
      data: '2026-11-05',
      hora: '09:00',
      barbeiroId: 1,
      desconto: 0,
      itens: [{ tipo: 'produto', nome: 'Óleo', preco: 34.9 }],
    },
    {
      estado: 'cancelada',
      data: '2026-11-06',
      hora: '09:00',
      desconto: 0,
      itens: [{ tipo: 'servico', preco: 999 }],
    },
    {
      estado: 'aberta',
      data: '2026-11-07',
      hora: '09:00',
      desconto: 0,
      itens: [{ tipo: 'servico', preco: 999 }],
    },
  ];

  it('totais por tipo, total gasto (com desconto) e ticket médio só das pagas', () => {
    expect(resumoDeComandas(comandas)).toEqual({
      comandas: 3,
      totalServicos: 115,
      totalProdutos: 74.8,
      totalGasto: 184.9,
      ticketMedio: 61.63,
      ultimaVisita: '2026-11-05',
      ultimoServico: { nome: 'Corte', data: '2026-10-31', barbeiroId: 2 },
    });
  });

  it('sem comandas pagas', () => {
    expect(resumoDeComandas([])).toMatchObject({
      comandas: 0,
      totalGasto: 0,
      ticketMedio: 0,
      ultimoServico: null,
    });
  });
});
