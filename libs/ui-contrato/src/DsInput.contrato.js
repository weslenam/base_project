import { it, expect } from 'vitest';
import { esperar } from './apoio.js';

export function testarDsInput(DsInput, montar) {
  it('mostra o rótulo', () => {
    const w = montar(DsInput, { props: { rotulo: 'Nome' } });
    expect(w.text()).toContain('Nome');
  });

  it('mostra o valor do modelo', () => {
    const w = montar(DsInput, { props: { modelValue: 'Ana' } });
    expect(w.find('input').element.value).toBe('Ana');
  });

  it('emite update:modelValue ao digitar', async () => {
    const w = montar(DsInput);
    await w.find('input').setValue('Bruno');
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['Bruno']);
  });

  it('tipo senha esconde o texto', () => {
    const w = montar(DsInput, { props: { tipo: 'senha' } });
    expect(w.find('input').attributes('type')).toBe('password');
  });

  it('obrigatório: mostra "Campo obrigatório" ao apagar o valor', async () => {
    const w = montar(DsInput, { props: { obrigatorio: true } });
    await w.find('input').setValue('x');
    await w.find('input').setValue('');
    await esperar(() => expect(w.text()).toContain('Campo obrigatório'));
  });

  it('regras próprias exibem a mensagem devolvida', async () => {
    const regras = [(v) => v.length >= 3 || 'Mínimo de 3 caracteres'];
    const w = montar(DsInput, { props: { regras } });
    await w.find('input').setValue('ab');
    await esperar(() => expect(w.text()).toContain('Mínimo de 3 caracteres'));
  });

  it('mostra erro externo', () => {
    const w = montar(DsInput, { props: { erro: 'E-mail já cadastrado' } });
    expect(w.text()).toContain('E-mail já cadastrado');
  });

  it('desabilitado não aceita edição', () => {
    const w = montar(DsInput, { props: { desabilitado: true } });
    expect(w.find('input').attributes('disabled')).toBeDefined();
  });
}
