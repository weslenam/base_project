import { it, expect } from 'vitest';
import { h } from 'vue';

export function testarUseTema(useTema, montar) {
  function preparar() {
    let api;
    montar({ setup: () => ((api = useTema()), () => h('div')) });
    return api;
  }

  it('começa no tema claro e oferece claro e escuro', () => {
    const { tema, temas } = preparar();
    expect(tema.value).toBe('claro');
    expect(temas).toEqual(expect.arrayContaining(['claro', 'escuro']));
  });

  it('aplicar troca o tema e marca data-theme no documento (ADR 0003)', () => {
    const { tema, aplicar } = preparar();
    aplicar('escuro');
    expect(tema.value).toBe('escuro');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('rejeita tema desconhecido', () => {
    const { aplicar } = preparar();
    expect(() => aplicar('roxo')).toThrow(/Tema desconhecido/);
  });
}
