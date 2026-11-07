import { it, expect } from 'vitest';
import { h } from 'vue';
import { esperar } from './apoio.js';

/** DsLayout vive dentro do DsApp; o contrato monta os dois juntos. */
export function testarDsLayout({ DsApp, DsLayout }, montar) {
  const montarLayout = (props, slots = {}) =>
    montar(DsApp, { slots: { default: () => h(DsLayout, props, slots) } });

  it('mostra o título e o conteúdo', async () => {
    const w = montarLayout(
      { titulo: 'BarberTime' },
      { default: () => 'Conteúdo da página' },
    );
    await esperar(() => {
      expect(w.text()).toContain('BarberTime');
      expect(w.text()).toContain('Conteúdo da página');
    });
  });

  it('lista os itens do menu', async () => {
    const itensMenu = [
      { titulo: 'Agenda', rota: '/agenda' },
      { titulo: 'Clientes', rota: '/clientes' },
    ];
    const w = montarLayout({ titulo: 'BarberTime', itensMenu });
    await esperar(() => {
      expect(w.text()).toContain('Agenda');
      expect(w.text()).toContain('Clientes');
    });
  });

  it('renderiza o slot cabecalho-acoes', async () => {
    const w = montarLayout(
      { titulo: 'BarberTime' },
      { 'cabecalho-acoes': () => 'Sair' },
    );
    await esperar(() => expect(w.text()).toContain('Sair'));
  });

  it('renderiza o slot marca', async () => {
    const w = montarLayout({ titulo: 'BarberTime' }, { marca: () => 'LOGO' });
    await esperar(() => expect(w.text()).toContain('LOGO'));
  });
}
