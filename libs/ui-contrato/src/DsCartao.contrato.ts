import { it, expect } from 'vitest';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

export function testarDsCartao(DsCartao: Component, montar: Montar) {
  it('mostra o título como cabeçalho, o conteúdo e as ações', () => {
    const w = montar(DsCartao, {
      props: { titulo: 'Próximos horários' },
      slots: { default: 'Lista', acoes: 'Ver agenda' },
    });
    expect(w.find('h3').text()).toBe('Próximos horários');
    expect(w.text()).toContain('Lista');
    expect(w.text()).toContain('Ver agenda');
  });

  it('é uma região nomeada pelo título', () => {
    const w = montar(DsCartao, { props: { titulo: 'Caixa' } });
    expect(w.find('section[aria-label="Caixa"]').exists()).toBe(true);
  });

  it('sem título não renderiza cabeçalho', () => {
    const w = montar(DsCartao, { slots: { default: 'Só conteúdo' } });
    expect(w.find('h3').exists()).toBe(false);
  });
}
