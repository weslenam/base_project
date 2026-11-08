import { describe, expect, it } from 'vitest';
import {
  CONFIG_BARBEARIA_PADRAO,
  mesclarConfigBarbearia,
  validarConfigBarbearia,
} from './barbearia.js';

const valida = () => mesclarConfigBarbearia({});

describe('configurações da barbearia', () => {
  it('o padrão é válido: abre de segunda a sábado', () => {
    expect(validarConfigBarbearia(valida())).toBeNull();
    const abertos = CONFIG_BARBEARIA_PADRAO.funcionamento.filter(
      (d) => d.aberto,
    );
    expect(abertos.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('mescla o gravado com o padrão sem perder o que falta', () => {
    const c = mesclarConfigBarbearia({
      contato: { instagram: '@zebarbeiro' },
      funcionamento: [{ dia: 0, aberto: true, abre: '10:00', fecha: '14:00' }],
    });
    expect(c.contato).toEqual({
      telefone: null,
      endereco: '',
      instagram: '@zebarbeiro',
    });
    expect(c.funcionamento[0]).toMatchObject({ aberto: true, abre: '10:00' });
    expect(c.funcionamento).toHaveLength(7);
    expect(c.agendamento.diasAFrente).toBe(30);
  });

  it('não altera o padrão ao mesclar', () => {
    const c = mesclarConfigBarbearia();
    c.funcionamento[1].abre = '06:00';
    expect(CONFIG_BARBEARIA_PADRAO.funcionamento[1].abre).toBe('09:00');
  });

  it('recusa fechamento antes da abertura, citando o dia', () => {
    const c = valida();
    c.funcionamento[2] = {
      dia: 2,
      aberto: true,
      abre: '18:00',
      fecha: '09:00',
    };
    expect(validarConfigBarbearia(c)).toBe(
      'Terça: o fechamento precisa ser depois da abertura.',
    );
  });

  it('dia fechado não precisa de horário', () => {
    const c = valida();
    c.funcionamento[3] = { dia: 3, aberto: false, abre: '', fecha: '' };
    expect(validarConfigBarbearia(c)).toBeNull();
  });

  it('precisa abrir em pelo menos um dia', () => {
    const c = valida();
    c.funcionamento.forEach((d) => (d.aberto = false));
    expect(validarConfigBarbearia(c)).toContain('pelo menos um dia');
  });

  it('valida telefone, instagram e limites do agendamento', () => {
    expect(
      validarConfigBarbearia({ ...valida(), contato: { telefone: '123' } }),
    ).toContain('Telefone');
    expect(
      validarConfigBarbearia({
        ...valida(),
        contato: { instagram: 'zé barbeiro' },
      }),
    ).toContain('Instagram');
    const c = valida();
    c.agendamento.diasAFrente = 0;
    expect(validarConfigBarbearia(c)).toBe(
      'O limite de dias à frente precisa ser um número inteiro entre 1 e 180.',
    );
    c.agendamento.diasAFrente = 30;
    c.agendamento.antecedenciaMinimaHoras = 1.5;
    expect(validarConfigBarbearia(c)).toContain('antecedência mínima');
  });
});
