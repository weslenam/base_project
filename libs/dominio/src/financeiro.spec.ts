import { describe, expect, it } from 'vitest';
import {
  movimentoDaBaixa,
  situacaoDaConta,
  totaisDasContas,
  validarBaixa,
  validarConta,
} from './financeiro.ts';
import { resumoDoCaixa } from './caixa.ts';

// Planejamento 0027, parte 2 (fatia 2A): contas a pagar e a receber e o
// efeito da baixa em dinheiro no caixa do dia.

const HOJE = '2026-11-09';
const conta = (extra = {}) => ({
  tipo: 'pagar',
  descricao: 'Aluguel',
  categoriaId: 1,
  valor: 1500,
  vencimento: '2026-11-10',
  situacao: 'aberta',
  ...extra,
});

describe('situação da conta', () => {
  it('aberta com vencimento antes de hoje é vencida; a de hoje ainda não', () => {
    expect(situacaoDaConta(conta({ vencimento: '2026-11-08' }), HOJE)).toBe(
      'vencida',
    );
    expect(situacaoDaConta(conta({ vencimento: HOJE }), HOJE)).toBe('aberta');
    expect(
      situacaoDaConta(
        conta({ vencimento: '2026-11-01', situacao: 'quitada' }),
        HOJE,
      ),
    ).toBe('quitada');
  });
});

describe('validação', () => {
  it('conta precisa de tipo, descrição, categoria, valor e vencimento', () => {
    expect(validarConta(conta())).toBeNull();
    expect(validarConta(conta({ tipo: 'outro' }))).toMatch(
      /pagar ou a receber/,
    );
    expect(validarConta(conta({ descricao: '  ' }))).toMatch(/descrição/);
    expect(validarConta(conta({ categoriaId: null }))).toMatch(/categoria/);
    expect(validarConta(conta({ valor: 0 }))).toMatch(/valor/);
    expect(validarConta(conta({ vencimento: '10/11/2026' }))).toMatch(
      /vencimento/,
    );
  });

  it('baixa precisa de data, valor pago e forma conhecida', () => {
    const ok = { data: HOJE, valorPago: 10, forma: 'pix' };
    expect(validarBaixa(ok)).toBeNull();
    expect(validarBaixa({ ...ok, data: '' })).toMatch(/data/);
    expect(validarBaixa({ ...ok, valorPago: -1 })).toMatch(/valor pago/);
    expect(validarBaixa({ ...ok, forma: 'cheque' })).toMatch(/forma/);
  });
});

describe('#29: limite do valor', () => {
  it('#29: valor acima de R$ 999.999.999,99 ou infinito é recusado', () => {
    expect(validarConta(conta({ valor: 999999999.99 }))).toBeNull();
    expect(validarConta(conta({ valor: 1e10 }))).toMatch(/valor/);
    expect(validarConta(conta({ valor: Infinity }))).toMatch(/valor/);
    expect(
      validarBaixa({ data: HOJE, valorPago: Infinity, forma: 'pix' }),
    ).toMatch(/valor pago/);
  });
});

describe('baixa no caixa', () => {
  it('dinheiro do caixa: pagar é saída, receber é entrada; outras formas não mexem', () => {
    expect(
      movimentoDaBaixa(conta(), { forma: 'dinheiro_caixa', valorPago: 99.9 }),
    ).toEqual({ tipo: 'saida', valor: 99.9, descricao: 'Aluguel' });
    expect(
      movimentoDaBaixa(conta({ tipo: 'receber' }), {
        forma: 'dinheiro_caixa',
        valorPago: 50,
      })?.tipo,
    ).toBe('entrada');
    expect(
      movimentoDaBaixa(conta(), { forma: 'pix', valorPago: 10 }),
    ).toBeNull();
  });

  it('saídas e entradas mudam o dinheiro esperado na gaveta', () => {
    const r = resumoDoCaixa({
      valorInicial: 100,
      comandas: [{ estado: 'paga', forma: 'dinheiro', itens: [{ preco: 50 }] }],
      movimentos: [
        { tipo: 'saida', valor: 30.1 },
        { tipo: 'entrada', valor: 10 },
      ],
    });
    expect(r).toMatchObject({
      saidas: 30.1,
      entradas: 10,
      dinheiroEsperado: 129.9,
      totalRecebido: 50,
    });
  });
});

describe('totais das contas', () => {
  it('separa aberto, vencido e quitado (pelo valor pago)', () => {
    expect(
      totaisDasContas(
        [
          conta({ valor: 100 }),
          conta({ valor: 50, vencimento: '2026-11-01' }),
          conta({ valor: 80, situacao: 'quitada', valorPago: 82.5 }),
          conta({ valor: 999, situacao: 'cancelada' }),
        ],
        HOJE,
      ),
    ).toEqual({ aberto: 100, vencido: 50, quitado: 82.5 });
  });
});
