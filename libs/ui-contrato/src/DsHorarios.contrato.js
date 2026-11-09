import { it, expect } from 'vitest';

const opcoes = [
  { hora: '09:00', disponivel: true },
  { hora: '09:30', disponivel: false },
  { hora: '10:00', disponivel: true },
];

export function testarDsHorarios(DsHorarios, montar) {
  it('um botão por horário, num grupo nomeado', () => {
    const w = montar(DsHorarios, {
      props: { opcoes, rotulo: 'Horários de sábado' },
    });
    expect(
      w.find('[role="group"][aria-label="Horários de sábado"]').exists(),
    ).toBe(true);
    expect(w.findAll('button').map((b) => b.text())).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ]);
  });

  it('horário indisponível fica desabilitado', () => {
    const w = montar(DsHorarios, { props: { opcoes } });
    expect(w.findAll('button')[1].attributes('disabled')).toBeDefined();
  });

  it('marca o selecionado com aria-pressed', () => {
    const w = montar(DsHorarios, { props: { opcoes, modelValue: '10:00' } });
    const pressionados = w.findAll('button[aria-pressed="true"]');
    expect(pressionados.map((b) => b.text())).toEqual(['10:00']);
  });

  it('clicar emite o horário', async () => {
    const w = montar(DsHorarios, { props: { opcoes } });
    await w.findAll('button')[0].trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['09:00']);
  });

  it('sem opções mostra o texto de vazio', () => {
    expect(montar(DsHorarios, { props: { opcoes: [] } }).text()).toContain(
      'Nenhum horário livre neste dia',
    );
  });
}
