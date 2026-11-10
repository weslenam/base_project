import { it, expect } from 'vitest';
import { esperar } from './apoio.ts';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

export function testarDsTextarea(DsTextarea: Component, montar: Montar) {
  it('mostra o rótulo e emite o texto digitado', async () => {
    const w = montar(DsTextarea, { props: { rotulo: 'Observações' } });
    expect(w.text()).toContain('Observações');
    await w.find('textarea').setValue('Prefere máquina 2');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([
      'Prefere máquina 2',
    ]);
  });

  it('limite de caracteres mostra a mensagem', async () => {
    const w = montar(DsTextarea, { props: { maxCaracteres: 5 } });
    await w.find('textarea').setValue('123456');
    await esperar(() => expect(w.text()).toContain('Máximo de 5 caracteres'));
  });
}
