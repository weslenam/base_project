import { it, expect } from 'vitest';
import { exigir } from './apoio.ts';
import { h } from 'vue';
import type { ApiDeTema, Montar } from './apoio.ts';

export function testarUseTema(useTema: () => ApiDeTema, montar: Montar) {
  function preparar() {
    let api: ApiDeTema | undefined;
    montar({ setup: () => ((api = useTema()), () => h('div')) });
    return exigir(api, 'useTema');
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
