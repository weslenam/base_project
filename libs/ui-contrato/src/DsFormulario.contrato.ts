import { it, expect } from 'vitest';
import { h, ref } from 'vue';
import { esperar } from './apoio.ts';
import type { Component } from 'vue';
import type { Montar } from './apoio.ts';

/** O formulário só emite `enviar` quando todos os campos são válidos. */
export function testarDsFormulario(
  {
    DsFormulario,
    DsInput,
    DsBotao,
  }: { DsFormulario: Component; DsInput: Component; DsBotao: Component },
  montar: Montar,
) {
  function preparar(valorInicial: string) {
    const nome = ref(valorInicial);
    const w = montar(DsFormulario, {
      props: { id: 'form-teste' },
      slots: {
        default: () =>
          h(DsInput, {
            rotulo: 'Nome',
            obrigatorio: true,
            modelValue: nome.value,
            'onUpdate:modelValue': (v: string) => (nome.value = v),
          }),
      },
    });
    return w;
  }

  it('inválido: não emite enviar, emite invalido e mostra o erro', async () => {
    const w = preparar('');
    await w.find('form').trigger('submit');
    await esperar(() => expect(w.emitted('invalido')).toBeTruthy());
    expect(w.emitted('enviar')).toBeFalsy();
    await esperar(() => expect(w.text()).toContain('Campo obrigatório'));
  });

  it('válido: emite enviar', async () => {
    const w = preparar('Ana');
    await w.find('form').trigger('submit');
    await esperar(() => expect(w.emitted('enviar')).toHaveLength(1));
  });

  it('DsBotao com formulario="id" vira submit ligado ao form', () => {
    const b = montar(DsBotao, {
      props: { formulario: 'form-teste' },
      slots: { default: 'Salvar' },
    });
    expect(b.find('button').attributes('type')).toBe('submit');
    expect(b.find('button').attributes('form')).toBe('form-teste');
  });
}
