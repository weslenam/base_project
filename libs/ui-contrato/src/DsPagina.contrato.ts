import { it, expect } from 'vitest';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

export function testarDsPagina(DsPagina: Component, montar: Montar) {
  it('título é o h1 da tela, com sobretítulo, ações e conteúdo', () => {
    const w = montar(DsPagina, {
      props: { titulo: 'Agenda', sobretitulo: 'Sáb, 8/11' },
      slots: { acoes: 'Novo agendamento', default: 'Conteúdo' },
    });
    expect(w.find('h1').text()).toBe('Agenda');
    for (const t of ['Sáb, 8/11', 'Novo agendamento', 'Conteúdo'])
      expect(w.text()).toContain(t);
  });
}
