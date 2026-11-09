import { describe, expect, it } from 'vitest';
import {
  estadoNaAgenda,
  ordenarFila,
  podeTransitar,
  situacaoDosBarbeiros,
  sugerirEncaixe,
} from './balcao.js';

const barbeiros = [
  { id: 1, nome: 'João', inicio: '09:00', fim: '19:00' },
  { id: 2, nome: 'Léo', inicio: '09:00', fim: '19:00' },
];

describe('ciclo de vida do atendimento', () => {
  it('segue o caminho da especificação', () => {
    expect(podeTransitar('agendado', 'chegou')).toBe(true);
    expect(podeTransitar('na_fila', 'em_atendimento')).toBe(true);
    expect(podeTransitar('em_atendimento', 'finalizado')).toBe(true);
    expect(podeTransitar('finalizado', 'pago')).toBe(true);
    expect(podeTransitar('agendado', 'em_atendimento')).toBe(false);
    expect(podeTransitar('pago', 'cancelado')).toBe(false);
  });

  it('traduz para a agenda atual', () => {
    expect(estadoNaAgenda({ estado: 'agendado' })).toBe('pendente');
    expect(estadoNaAgenda({ estado: 'agendado', confirmadoEm: 'x' })).toBe(
      'confirmado',
    );
    expect(estadoNaAgenda({ estado: 'pago' })).toBe('atendido');
    expect(estadoNaAgenda({ estado: 'no_show' })).toBe('faltou');
  });
});

describe('fila', () => {
  it('agendado no horário, depois agendado atrasado, depois avulsos por chegada', () => {
    const fila = ordenarFila([
      { id: 1, estado: 'na_fila', chegouAs: '10:00' },
      { id: 2, estado: 'chegou', inicio: '10:30', chegouAs: '10:25' },
      { id: 3, estado: 'na_fila', chegouAs: '09:50' },
      { id: 4, estado: 'chegou', inicio: '10:00', chegouAs: '10:20' }, // 20 min atrasado
      { id: 5, estado: 'em_atendimento' },
    ]);
    expect(fila.map((a) => a.id)).toEqual([2, 4, 3, 1]);
  });
});

describe('encaixe sem atropelar quem agendou', () => {
  const situacao = (atendimentos, agora = '10:00') =>
    situacaoDosBarbeiros({ barbeiros, atendimentos, agora });

  it('barbeiro livre com janela suficiente pode atender agora', () => {
    const s = situacao([
      {
        id: 9,
        barbeiroId: 1,
        estado: 'agendado',
        inicio: '11:00',
        fim: '11:30',
      },
    ]);
    const r = sugerirEncaixe({ situacao: s, duracao: 30, agora: '10:00' });
    expect(r.porBarbeiro[0]).toMatchObject({ podeAgora: true, esperaMin: 0 });
  });

  it('janela menor que duração + folga: espera até depois do agendado', () => {
    const s = situacao([
      {
        id: 9,
        barbeiroId: 1,
        estado: 'agendado',
        inicio: '10:30',
        fim: '11:00',
      },
    ]);
    const r = sugerirEncaixe({
      situacao: s.filter((x) => x.id === 1),
      duracao: 30,
      agora: '10:00',
    });
    // 30 min de janela < 30 + 5 de folga
    expect(r.porBarbeiro[0]).toMatchObject({
      podeAgora: false,
      inicioPrevisto: '11:00',
      esperaMin: 60,
    });
  });

  it('ocupado: previsão a partir do fim do atendimento atual', () => {
    const s = situacao([
      {
        id: 7,
        barbeiroId: 2,
        estado: 'em_atendimento',
        iniciadoAs: '09:50',
        duracao: 40,
      },
    ]);
    expect(s[1]).toMatchObject({
      estado: 'ocupado',
      livreEm: '10:30',
      restanteMin: 30,
    });
    const r = sugerirEncaixe({ situacao: s, duracao: 30, agora: '10:00' });
    expect(r.porBarbeiro[1]).toMatchObject({ podeAgora: false, esperaMin: 30 });
    expect(r.primeiroLivre.barbeiroId).toBe(1);
  });

  it('a fila que já espera entra na previsão; pausa sai da sugestão', () => {
    const s = situacaoDosBarbeiros({
      barbeiros: [{ ...barbeiros[0] }, { ...barbeiros[1], emPausa: true }],
      atendimentos: [],
      agora: '10:00',
    });
    const r = sugerirEncaixe({
      situacao: s,
      fila: [{ id: 3, estado: 'na_fila', barbeiroId: null, duracao: 30 }],
      duracao: 30,
      agora: '10:00',
    });
    expect(r.porBarbeiro[0]).toMatchObject({ esperaMin: 30, podeAgora: false });
    expect(r.porBarbeiro[1]).toMatchObject({ inicioPrevisto: null });
  });

  it('agendado que passou da tolerância e não chegou não segura o horário', () => {
    const s = situacao(
      [
        {
          id: 9,
          barbeiroId: 1,
          estado: 'agendado',
          inicio: '09:30',
          fim: '10:00',
        },
      ],
      '09:45',
    );
    expect(s[0].reservados).toHaveLength(0);
  });

  it('não cabe antes do fim do expediente: sem previsão hoje', () => {
    const s = situacao([], '18:45');
    const r = sugerirEncaixe({ situacao: s, duracao: 30, agora: '18:45' });
    expect(r.porBarbeiro[0].inicioPrevisto).toBeNull();
    expect(r.primeiroLivre).toBeNull();
  });
});
