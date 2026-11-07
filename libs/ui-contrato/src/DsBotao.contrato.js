import { it, expect } from 'vitest';

export function testarDsBotao(DsBotao, montar) {
  it('renderiza o conteúdo do slot', () => {
    const w = montar(DsBotao, { slots: { default: 'Salvar' } });
    expect(w.text()).toContain('Salvar');
  });

  it('emite click', async () => {
    const w = montar(DsBotao, { slots: { default: 'Salvar' } });
    await w.find('button').trigger('click');
    expect(w.emitted('click')).toHaveLength(1);
  });

  it('não emite click quando desabilitado', async () => {
    const w = montar(DsBotao, {
      props: { desabilitado: true },
      slots: { default: 'Salvar' },
    });
    await w.find('button').trigger('click');
    expect(w.emitted('click')).toBeFalsy();
  });

  it('não emite click enquanto carregando', async () => {
    const w = montar(DsBotao, {
      props: { carregando: true },
      slots: { default: 'Salvar' },
    });
    await w.find('button').trigger('click');
    expect(w.emitted('click')).toBeFalsy();
  });

  it('tipo padrão é button; aceita submit', () => {
    expect(montar(DsBotao).find('button').attributes('type')).toBe('button');
    expect(
      montar(DsBotao, { props: { tipo: 'submit' } })
        .find('button')
        .attributes('type'),
    ).toBe('submit');
  });

  it.each(['primario', 'secundario', 'perigo', 'fantasma'])(
    'variante %s renderiza e emite click',
    async (variante) => {
      const w = montar(DsBotao, {
        props: { variante },
        slots: { default: 'Ok' },
      });
      await w.find('button').trigger('click');
      expect(w.emitted('click')).toHaveLength(1);
    },
  );
}
