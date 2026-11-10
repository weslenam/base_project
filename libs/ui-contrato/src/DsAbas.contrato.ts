import { it, expect } from 'vitest';
import { exigir } from './apoio.ts';
import { h } from 'vue';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

const abas = [
  { valor: 'servico', rotulo: 'Serviços' },
  { valor: 'produto', rotulo: 'Produtos' },
];
const slots = {
  servico: () => h('p', 'Lista de serviços'),
  produto: () => h('p', 'Lista de produtos'),
};

export function testarDsAbas(DsAbas: Component, montar: Montar) {
  it('tablist com uma aba por item; a ativa tem aria-selected', () => {
    const w = montar(DsAbas, {
      props: { abas, modelValue: 'servico', rotulo: 'Itens' },
      slots,
    });
    expect(w.find('[role="tablist"][aria-label="Itens"]').exists()).toBe(true);
    const tabs = w.findAll('[role="tab"]');
    expect(tabs.map((t) => t.text())).toEqual(['Serviços', 'Produtos']);
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    expect(tabs[1].attributes('aria-selected')).toBe('false');
  });

  it('mostra só o painel da aba ativa, ligado à aba', () => {
    const w = montar(DsAbas, { props: { abas, modelValue: 'produto' }, slots });
    const paineis = w.findAll('[role="tabpanel"]');
    const visivel = exigir(
      paineis.find((p) => p.isVisible()),
      'painel visível',
    );
    expect(visivel.text()).toBe('Lista de produtos');
    const aba = w.find(`#${visivel.attributes('aria-labelledby')}`);
    expect(aba.text()).toBe('Produtos');
  });

  it('clicar numa aba emite o valor', async () => {
    const w = montar(DsAbas, { props: { abas, modelValue: 'servico' }, slots });
    await exigir(w.findAll('[role="tab"]')[1], 'aba 2').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['produto']);
  });

  it('seta para a direita vai para a próxima aba', async () => {
    const w = montar(DsAbas, { props: { abas, modelValue: 'servico' }, slots });
    await exigir(w.findAll('[role="tab"]')[0], 'aba 1').trigger('keydown', {
      key: 'ArrowRight',
    });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['produto']);
  });
}
