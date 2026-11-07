import { it, expect } from 'vitest';

const opcoes = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
];

export function testarDsEscolha(DsEscolha, montar) {
  it('grupo nomeado com um botão por opção', () => {
    const w = montar(DsEscolha, {
      props: { opcoes, rotulo: 'Forma de pagamento' },
    });
    expect(
      w.find('[role="group"][aria-label="Forma de pagamento"]').exists(),
    ).toBe(true);
    expect(w.findAll('button').map((b) => b.text())).toEqual([
      'Dinheiro',
      'Pix',
    ]);
  });

  it('marca a escolhida com aria-pressed', () => {
    const w = montar(DsEscolha, {
      props: { opcoes, rotulo: 'x', modelValue: 'pix' },
    });
    expect(
      w.findAll('button[aria-pressed="true"]').map((b) => b.text()),
    ).toEqual(['Pix']);
  });

  it('clicar emite o valor', async () => {
    const w = montar(DsEscolha, { props: { opcoes, rotulo: 'x' } });
    await w.findAll('button')[0].trigger('click');
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['dinheiro']);
  });

  it('desabilitado não deixa escolher', () => {
    const w = montar(DsEscolha, {
      props: { opcoes, rotulo: 'x', desabilitado: true },
    });
    expect(
      w.findAll('button').every((b) => b.attributes('disabled') !== undefined),
    ).toBe(true);
  });
}
