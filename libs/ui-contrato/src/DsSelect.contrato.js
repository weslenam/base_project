import { it, expect } from 'vitest';
import { esperar } from './apoio.js';

const opcoes = [
  { valor: 'a', rotulo: 'Corte' },
  { valor: 'b', rotulo: 'Barba' },
];

export function testarDsSelect(DsSelect, montar) {
  it('mostra o rótulo', () => {
    const w = montar(DsSelect, { props: { rotulo: 'Serviço', opcoes } });
    expect(w.text()).toContain('Serviço');
  });

  it('exibe o rótulo da opção selecionada (não o valor)', () => {
    const w = montar(DsSelect, { props: { opcoes, modelValue: 'b' } });
    expect(w.text()).toContain('Barba');
  });

  it('ao escolher uma opção emite o valor dela', async () => {
    const w = montar(DsSelect, { props: { opcoes } });
    await w.find('[role="combobox"]').trigger('mousedown');
    await esperar(() =>
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(2),
    );
    const corte = [...document.querySelectorAll('[role="option"]')].find((o) =>
      o.textContent.includes('Corte'),
    );
    corte.click();
    await esperar(() =>
      expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['a']),
    );
  });
}
