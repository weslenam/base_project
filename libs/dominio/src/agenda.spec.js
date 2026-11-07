import {
  diaDaSemana,
  fimDe,
  hojeIso,
  horariosLivres,
  ocupaHorario,
  paraHora,
  paraMinutos,
  sobrepoe,
  somarDias,
} from './agenda.js';

describe('horas', () => {
  it('converte ida e volta', () => {
    expect(paraMinutos('09:30')).toBe(570);
    expect(paraHora(570)).toBe('09:30');
    expect(fimDe('09:30', 45)).toBe('10:15');
  });
});

describe('sobrepoe', () => {
  const a = { inicio: '10:00', fim: '10:30' };
  it.each([
    [{ inicio: '10:15', fim: '10:45' }, true],
    [{ inicio: '09:30', fim: '10:01' }, true],
    [{ inicio: '09:00', fim: '11:00' }, true],
    [{ inicio: '10:30', fim: '11:00' }, false],
    [{ inicio: '09:30', fim: '10:00' }, false],
  ])('%o → %s', (b, esperado) => expect(sobrepoe(a, b)).toBe(esperado));
});

describe('horariosLivres', () => {
  const expediente = { inicio: '09:00', fim: '11:00' };

  it('gera horários no passo, só os que cabem no expediente', () => {
    const horas = horariosLivres({ expediente, duracao: 45 }).map(
      (h) => h.hora,
    );
    expect(horas).toEqual(['09:00', '09:30', '10:00']);
  });

  it('marca indisponível o que sobrepõe ocupados', () => {
    const r = horariosLivres({
      expediente,
      duracao: 30,
      ocupados: [{ inicio: '09:30', fim: '10:00' }],
    });
    expect(r).toEqual([
      { hora: '09:00', disponivel: true },
      { hora: '09:30', disponivel: false },
      { hora: '10:00', disponivel: true },
      { hora: '10:30', disponivel: true },
    ]);
  });

  it('serviço longo só cabe onde termina antes do ocupado (encostar pode)', () => {
    const r = horariosLivres({
      expediente,
      duracao: 60,
      ocupados: [{ inicio: '10:00', fim: '10:30' }],
    });
    // 09:00–10:00 encosta e cabe; 09:30–10:30 e 10:00–11:00 sobrepõem.
    expect(r).toEqual([
      { hora: '09:00', disponivel: true },
      { hora: '09:30', disponivel: false },
      { hora: '10:00', disponivel: false },
    ]);
  });

  it('aPartirDe esconde horários passados', () => {
    const r = horariosLivres({ expediente, duracao: 30, aPartirDe: '10:00' });
    expect(r.filter((h) => h.disponivel).map((h) => h.hora)).toEqual([
      '10:00',
      '10:30',
    ]);
  });
});

describe('estados', () => {
  it('só cancelado libera o horário', () => {
    expect(ocupaHorario('cancelado')).toBe(false);
    for (const e of [
      'pendente',
      'confirmado',
      'atendido',
      'faltou',
      'bloqueado',
    ]) {
      expect(ocupaHorario(e)).toBe(true);
    }
  });
});

describe('datas', () => {
  it('somarDias atravessa mês e ano', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('hojeIso e diaDaSemana', () => {
    expect(hojeIso(new Date(2026, 10, 7, 23, 59))).toBe('2026-11-07');
    expect(diaDaSemana('2026-11-07')).toBe(6);
  });
});
