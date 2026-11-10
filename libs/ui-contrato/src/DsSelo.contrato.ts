import { it, expect } from 'vitest';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

export function testarDsSelo(DsSelo: Component, montar: Montar) {
  it.each([
    ['confirmado', 'Confirmado'],
    ['pendente', 'Pendente'],
    ['assinante', 'Assinante'],
    ['fila', 'Na fila'],
    ['faltou', 'Faltou'],
  ])('estado %s mostra a palavra "%s" (nunca só cor)', (estado, texto) => {
    expect(montar(DsSelo, { props: { estado } }).text()).toBe(texto);
  });

  it('o slot substitui o texto padrão', () => {
    const w = montar(DsSelo, {
      props: { estado: 'neutro' },
      slots: { default: '3 na fila' },
    });
    expect(w.text()).toBe('3 na fila');
  });
}
