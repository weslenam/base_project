import { it, expect } from 'vitest';
import { exigir } from './apoio.ts';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

const passos = [
  { rotulo: 'Serviço' },
  { rotulo: 'Barbeiro' },
  { rotulo: 'Dia' },
];

export function testarDsPassos(DsPassos: Component, montar: Montar) {
  it('lista as etapas e marca a atual com aria-current="step"', () => {
    const w = montar(DsPassos, { props: { passos, modelValue: 1 } });
    const itens = w.findAll('li');
    expect(itens.map((li) => li.text())).toEqual([
      '1Serviço',
      '2Barbeiro',
      '3Dia',
    ]);
    expect(itens[1].attributes('aria-current')).toBe('step');
    expect(w.text()).toContain('Etapa 2 de 3: Barbeiro');
  });

  it('etapas concluídas são botões para voltar; futuras não', async () => {
    const w = montar(DsPassos, { props: { passos, modelValue: 2 } });
    const botoes = w.findAll('button');
    expect(botoes.map((b) => b.attributes('aria-label'))).toEqual([
      'Voltar para Serviço',
      'Voltar para Barbeiro',
    ]);
    await exigir(botoes[0], 'passo 1').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([0]);
  });
}
