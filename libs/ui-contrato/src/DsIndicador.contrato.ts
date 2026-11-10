import { it, expect } from 'vitest';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

export function testarDsIndicador(DsIndicador: Component, montar: Montar) {
  it('é uma região nomeada pelo rótulo, com valor e detalhe', () => {
    const w = montar(DsIndicador, {
      props: { rotulo: 'Clientes', valor: 35, detalhe: '7 novos no mês' },
    });
    expect(w.find('section[aria-label="Clientes"]').exists()).toBe(true);
    expect(w.text()).toContain('35');
    expect(w.text()).toContain('7 novos no mês');
  });

  it('mostra a variação com sinal, vírgula e tendência', () => {
    const sobe = montar(DsIndicador, {
      props: {
        rotulo: 'Faturamento',
        valor: 'R$ 100,00',
        variacao: 12.5,
        comparacao: 'mês anterior',
      },
    });
    expect(sobe.text()).toContain('+12,5% vs mês anterior');
    expect(sobe.find('[data-tendencia="sobe"]').exists()).toBe(true);

    const cai = montar(DsIndicador, {
      props: { rotulo: 'Ticket', valor: 'R$ 50,00', variacao: -0.2 },
    });
    expect(cai.text()).toContain('-0,2% vs período anterior');
    expect(cai.find('[data-tendencia="cai"]').exists()).toBe(true);
  });

  it('sem base para comparar avisa; sem variação não mostra a linha', () => {
    const semBase = montar(DsIndicador, {
      props: {
        rotulo: 'Faturamento',
        valor: 'R$ 0,00',
        variacao: null,
        comparacao: 'mês anterior',
      },
    });
    expect(semBase.text()).toContain('sem base no mês anterior');

    const semLinha = montar(DsIndicador, {
      props: { rotulo: 'Clientes', valor: 3 },
    });
    expect(semLinha.find('[data-tendencia]').exists()).toBe(false);
  });
}
