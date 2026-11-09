import { it, expect } from 'vitest';

export function testarDsAcao(DsAcao, montar) {
  const base = {
    icone: 'check',
    titulo: 'Marcar atendido',
    descricao: 'Conclui o atendimento',
  };

  it('é um botão com título, descrição e ícone', () => {
    const w = montar(DsAcao, { props: base });
    const botao = w.find('button');
    expect(botao.attributes('type')).toBe('button');
    expect(botao.text()).toContain('Marcar atendido');
    expect(botao.text()).toContain('Conclui o atendimento');
    expect(botao.find('svg').exists()).toBe(true);
  });

  it('emite click', async () => {
    const w = montar(DsAcao, { props: base });
    await w.find('button').trigger('click');
    expect(w.emitted('click')).toHaveLength(1);
  });

  it('desabilitada não emite click', async () => {
    const w = montar(DsAcao, { props: { ...base, desabilitado: true } });
    await w.find('button').trigger('click');
    expect(w.emitted('click')).toBeFalsy();
  });

  it.each(['primario', 'secundario', 'perigo'])(
    'variante %s renderiza',
    (variante) => {
      expect(montar(DsAcao, { props: { ...base, variante } }).text()).toContain(
        'Marcar atendido',
      );
    },
  );
}
