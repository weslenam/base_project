import { it, expect } from 'vitest';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

export function testarDsIcone(
  {
    DsIcone,
    NOMES_DE_ICONES,
  }: { DsIcone: Component; NOMES_DE_ICONES: readonly string[] },
  montar: Montar,
) {
  it('o catálogo tem os ícones de navegação do MVP', () => {
    for (const nome of [
      'agenda',
      'clientes',
      'caixa',
      'comissao',
      'relatorios',
      'configuracoes',
    ]) {
      expect(NOMES_DE_ICONES).toContain(nome);
    }
  });

  it('todo nome do catálogo renderiza um SVG', () => {
    for (const nome of NOMES_DE_ICONES) {
      const w = montar(DsIcone, { props: { nome } });
      expect(w.find('svg').exists(), nome).toBe(true);
    }
  });

  it('com rótulo é uma imagem acessível', () => {
    const w = montar(DsIcone, {
      props: { nome: 'whatsapp', rotulo: 'WhatsApp' },
    });
    expect(w.find('[role="img"][aria-label="WhatsApp"]').exists()).toBe(true);
  });

  it('sem rótulo é decorativo (aria-hidden)', () => {
    const w = montar(DsIcone, { props: { nome: 'agenda' } });
    expect(w.find('[aria-hidden="true"]').exists()).toBe(true);
  });
}
