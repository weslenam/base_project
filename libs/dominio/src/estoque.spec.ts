import { describe, expect, it } from 'vitest';
import {
  ajusteDeInventario,
  baixasDaComanda,
  dividirParcelas,
  documentoValido,
  motivoParcelasInvalidas,
  sugestaoDeCompra,
  totalDaCompra,
} from './estoque.ts';

// Planejamento 0027 (parte 1).

describe('sugestaoDeCompra', () => {
  it('lista negativos primeiro e quem está no mínimo, sugerindo o dobro do mínimo', () => {
    const r = sugestaoDeCompra([
      { id: 1, nome: 'Pomada', saldo: 5, estoqueMinimo: 3 },
      { id: 2, nome: 'Gel', saldo: 3, estoqueMinimo: 3 },
      { id: 3, nome: 'Lâmina', saldo: -2, estoqueMinimo: 0 },
      { id: 4, nome: 'Toalha', saldo: 0, estoqueMinimo: 0 },
    ]);
    expect(r.map((p) => [p.produtoId, p.sugerido])).toEqual([
      [3, 2],
      [2, 3],
    ]);
    expect(r[0].negativo).toBe(true);
  });
});

describe('baixasDaComanda', () => {
  const produtos = {
    10: { tipo: 'revenda' },
    20: { tipo: 'consumivel' },
    30: { tipo: 'revenda' }, // virou revenda: some da ficha
  };
  it('revenda vendida e consumíveis da ficha, multiplicados pela quantidade', () => {
    const r = baixasDaComanda({
      itens: [
        { tipo: 'produto', refId: 10, quantidade: 2 },
        { tipo: 'servico', refId: 1, quantidade: 2 },
        { tipo: 'produto', refId: 99, quantidade: 1 }, // excluído: ignora
      ],
      fichas: [
        { servicoId: 1, produtoId: 20, quantidade: 0.5 },
        { servicoId: 1, produtoId: 30, quantidade: 1 },
      ],
      produtos,
    });
    expect(r).toEqual([
      { produtoId: 10, tipo: 'venda', quantidade: -2 },
      { produtoId: 20, tipo: 'consumo_servico', quantidade: -1 },
    ]);
  });
  it('soma o mesmo produto de vários itens num movimento só', () => {
    const r = baixasDaComanda({
      itens: [
        { tipo: 'produto', refId: 10, quantidade: 1 },
        { tipo: 'produto', refId: 10, quantidade: 3 },
      ],
      produtos,
    });
    expect(r).toEqual([{ produtoId: 10, tipo: 'venda', quantidade: -4 }]);
  });
});

describe('ajusteDeInventario', () => {
  it('diferença entre contado e saldo, sem movimento quando bate', () => {
    expect(ajusteDeInventario(10, 7.5)).toBe(-2.5);
    expect(ajusteDeInventario(-2, 3)).toBe(5);
    expect(ajusteDeInventario(4, 4)).toBeNull();
    expect(ajusteDeInventario(4, -1)).toBeNull();
  });
});

describe('compra e parcelas', () => {
  it('total = itens + frete − desconto, em centavos', () => {
    expect(
      totalDaCompra({
        itens: [
          { quantidade: 3, custoUnitario: 10.1 },
          { quantidade: 0.5, custoUnitario: 9.99 },
        ],
        frete: 15,
        desconto: 5,
      }),
    ).toEqual({ subtotal: 35.3, total: 45.3, motivo: null });
    expect(
      totalDaCompra({
        itens: [{ quantidade: 1, custoUnitario: 10 }],
        desconto: 20,
      }).motivo,
    ).toContain('desconto');
  });

  it('divide sem perder centavos e espaça os vencimentos', () => {
    expect(
      dividirParcelas(100, 3, {
        primeiroVencimento: '2026-12-01',
        intervaloDias: 30,
      }),
    ).toEqual([
      { parcela: 1, parcelas: 3, valor: 33.33, vencimento: '2026-12-01' },
      { parcela: 2, parcelas: 3, valor: 33.33, vencimento: '2026-12-31' },
      { parcela: 3, parcelas: 3, valor: 33.34, vencimento: '2027-01-30' },
    ]);
  });

  it('parcelas à mão precisam somar o total', () => {
    const p = [
      { valor: 50, vencimento: '2026-12-01' },
      { valor: 50, vencimento: '2027-01-01' },
    ];
    expect(motivoParcelasInvalidas(p, 100)).toBeNull();
    expect(motivoParcelasInvalidas(p, 120)).toContain('soma');
    expect(motivoParcelasInvalidas([], 10)).toContain('ao menos');
    expect(
      motivoParcelasInvalidas([{ valor: 0, vencimento: 'x' }], 0),
    ).toContain('valor e vencimento');
  });
});

describe('documentoValido', () => {
  it('aceita vazio, CPF e CNPJ válidos e recusa o resto', () => {
    expect(documentoValido('')).toBe(true);
    expect(documentoValido('52998224725')).toBe(true);
    expect(documentoValido('11222333000181')).toBe(true);
    expect(documentoValido('52998224724')).toBe(false);
    expect(documentoValido('11222333000180')).toBe(false);
    expect(documentoValido('11111111111')).toBe(false);
    expect(documentoValido('123')).toBe(false);
  });
});
