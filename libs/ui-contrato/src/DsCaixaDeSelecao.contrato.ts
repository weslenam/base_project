import { it, expect } from 'vitest';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

export function testarDsCaixaDeSelecao(
  DsCaixaDeSelecao: Component,
  montar: Montar,
) {
  it('checkbox nativo ligado ao rótulo', () => {
    const w = montar(DsCaixaDeSelecao, { props: { rotulo: 'Fechar o caixa' } });
    const caixa = w.find('input[type="checkbox"]');
    expect(w.find(`label[for="${caixa.attributes('id')}"]`).text()).toContain(
      'Fechar o caixa',
    );
  });

  it('reflete e emite o valor', async () => {
    const w = montar(DsCaixaDeSelecao, {
      props: { rotulo: 'x', modelValue: true },
    });
    expect(w.find('input').element.checked).toBe(true);
    await w.find('input').setValue(false);
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false]);
  });

  it('desabilitada não muda', () => {
    const w = montar(DsCaixaDeSelecao, {
      props: { rotulo: 'x', desabilitado: true },
    });
    expect(w.find('input').attributes('disabled')).toBeDefined();
  });
}
