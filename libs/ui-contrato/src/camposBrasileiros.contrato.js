import { it, expect } from 'vitest';
import { esperar } from './apoio.js';

const valorExibido = (w) => w.find('input').element.value;
const ultimoEmitido = (w) => w.emitted('update:modelValue')?.at(-1)?.[0];

export function testarDsInputTelefone(DsInputTelefone, montar) {
  it('guarda só dígitos e exibe com máscara', async () => {
    const w = montar(DsInputTelefone);
    await w.find('input').setValue('11987654321');
    expect(ultimoEmitido(w)).toBe('11987654321');
    await esperar(() => expect(valorExibido(w)).toBe('(11) 98765-4321'));
  });

  it('descarta letras', async () => {
    const w = montar(DsInputTelefone);
    await w.find('input').setValue('11a9');
    expect(ultimoEmitido(w)).toBe('119');
  });

  it('exibe o modelo recebido formatado', () => {
    const w = montar(DsInputTelefone, { props: { modelValue: '1134567890' } });
    expect(valorExibido(w)).toBe('(11) 3456-7890');
  });

  it('número incompleto mostra "Telefone inválido"', async () => {
    const w = montar(DsInputTelefone);
    await w.find('input').setValue('1198');
    await esperar(() => expect(w.text()).toContain('Telefone inválido'));
  });

  it('validarNumero=false não acusa número incompleto (uso em busca)', async () => {
    const w = montar(DsInputTelefone, { props: { validarNumero: false } });
    await w.find('input').setValue('1198');
    expect(ultimoEmitido(w)).toBe('1198');
    await new Promise((r) => setTimeout(r, 50));
    expect(w.text()).not.toContain('Telefone inválido');
  });

  it('tem rótulo padrão "Telefone"', () => {
    expect(montar(DsInputTelefone).text()).toContain('Telefone');
  });
}

export function testarDsInputCpf(DsInputCpf, montar) {
  it('guarda só dígitos e exibe com máscara', async () => {
    const w = montar(DsInputCpf);
    await w.find('input').setValue('52998224725');
    expect(ultimoEmitido(w)).toBe('52998224725');
    await esperar(() => expect(valorExibido(w)).toBe('529.982.247-25'));
  });

  it('CPF com dígito errado mostra "CPF inválido"', async () => {
    const w = montar(DsInputCpf);
    await w.find('input').setValue('52998224700');
    await esperar(() => expect(w.text()).toContain('CPF inválido'));
  });

  it('obrigatório vazio mostra "Campo obrigatório"', async () => {
    const w = montar(DsInputCpf, { props: { obrigatorio: true } });
    await w.find('input').setValue('1');
    await w.find('input').setValue('');
    await esperar(() => expect(w.text()).toContain('Campo obrigatório'));
  });
}

export function testarDsInputMoeda(DsInputMoeda, montar) {
  it('digita como centavos e guarda número em reais', async () => {
    const w = montar(DsInputMoeda);
    await w.find('input').setValue('4590');
    expect(ultimoEmitido(w)).toBe(45.9);
    await esperar(() => expect(valorExibido(w)).toBe('45,90'));
  });

  it('exibe o modelo recebido formatado em reais', () => {
    const w = montar(DsInputMoeda, { props: { modelValue: 1234.5 } });
    expect(valorExibido(w)).toBe('1.234,50');
    expect(w.text()).toContain('R$');
  });

  it('apagar tudo deixa o modelo vazio (null)', async () => {
    const w = montar(DsInputMoeda, { props: { modelValue: 10 } });
    await w.find('input').setValue('');
    expect(ultimoEmitido(w)).toBeNull();
  });
}
