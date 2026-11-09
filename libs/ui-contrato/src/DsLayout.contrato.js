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
      { titulo: 'Agenda', rota: '/agenda', icone: 'agenda' },
      { titulo: 'Clientes', rota: '/clientes' },
    ];
    const w = montarLayout({ titulo: 'BarberTime', itensMenu });
    await esperar(() => {
      expect(w.text()).toContain('Agenda');
      expect(w.text()).toContain('Clientes');
    });
  });

  it('agrupa itens com o mesmo grupo sob um subtítulo único', async () => {
    const itensMenu = [
      { titulo: 'Agenda', rota: '/agenda' },
      { titulo: 'Usuários', rota: '/usuarios', grupo: 'Administração' },
      { titulo: 'Módulos', rota: '/modulos', grupo: 'Administração' },
    ];
    const w = montarLayout({ titulo: 'BarberTime', itensMenu });
    await esperar(() => expect(w.text()).toContain('Módulos'));
    expect(w.text().match(/Administração/g)).toHaveLength(1);
    expect(w.text().indexOf('Administração')).toBeLessThan(
      w.text().indexOf('Usuários'),
    );
  });

  it('separa os grupos por linha, com ícones e itens do grupo recuados', async () => {
    const itensMenu = [
      { titulo: 'Agenda', rota: '/agenda', icone: 'agenda', grupo: 'Operação' },
      { titulo: 'Caixa', rota: '/caixa', icone: 'caixa', grupo: 'Operação' },
      {
        titulo: 'Usuários',
        rota: '/usuarios',
        icone: 'cliente',
        grupo: 'Administração',
      },
    ];
    const grupos = [
      { titulo: 'Operação', icone: 'fila' },
      { titulo: 'Administração', icone: 'configuracoes' },
    ];
    const w = montarLayout({ titulo: 'BarberTime', itensMenu, grupos });
    await esperar(() => expect(w.text()).toContain('Usuários'));
    // Uma linha entre os dois grupos (nenhuma antes do primeiro).
    expect(w.findAll('[role="separator"], hr')).toHaveLength(1);
    // 3 ícones de item + 2 de grupo.
    expect(w.findAll('.ds-icone')).toHaveLength(5);
    // Cada item marcado com o grupo a que pertence (recuo).
    expect(w.findAll('[data-ds-grupo="Operação"]')).toHaveLength(2);
    expect(w.findAll('[data-ds-grupo="Administração"]')).toHaveLength(1);
  });

  it('itens sem grupo não ganham título nem recuo', async () => {
    const itensMenu = [{ titulo: 'Agenda', rota: '/agenda' }];
    const w = montarLayout({ titulo: 'BarberTime', itensMenu });
    await esperar(() => expect(w.text()).toContain('Agenda'));
    expect(w.findAll('[data-ds-grupo]')).toHaveLength(0);
    expect(w.findAll('[role="separator"], hr')).toHaveLength(0);
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

  it('abas: navegação no lugar do menu lateral', async () => {
    const abas = [
      { titulo: 'Balcão', rota: '/balcao', icone: 'fila' },
      { titulo: 'Agenda', rota: '/agenda', icone: 'agenda' },
    ];
    const w = montarLayout({ titulo: 'BarberTime', abas });
    await esperar(() => {
      expect(w.text()).toContain('Balcão');
      expect(w.text()).toContain('Agenda');
    });
    expect(w.find('[aria-label="Navegação principal"]').exists()).toBe(true);
    // Sem itens de menu, não há sanduíche nem gaveta.
    expect(w.find('[aria-label="Abrir menu"]').exists()).toBe(false);
    expect(w.find('[aria-label="Menu principal"]').exists()).toBe(false);
  });
}

