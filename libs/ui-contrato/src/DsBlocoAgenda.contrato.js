import { it, expect } from 'vitest';

const base = {
  cliente: 'Rafael Souza',
  servico: 'Corte + barba',
  inicio: '10:20',
  fim: '11:10',
};

export function testarDsBlocoAgenda(DsBlocoAgenda, montar) {
  it('mostra horário, cliente e serviço', () => {
    const texto = montar(DsBlocoAgenda, { props: base }).text();
    expect(texto).toContain('10:20–11:10');
    expect(texto).toContain('Rafael Souza');
    expect(texto).toContain('Corte + barba');
  });

  it.each([
    ['confirmado', 'Confirmado'],
    ['assinante', 'Assinante'],
    ['encaixe', 'Encaixe'],
    ['bloqueado', 'Bloqueado'],
    ['atendido', 'Atendido'],
    ['faltou', 'Faltou'],
  ])('estado %s tem texto acessível "%s"', (estado, rotulo) => {
    expect(
      montar(DsBlocoAgenda, { props: { ...base, estado } }).text(),
    ).toContain(rotulo);
  });

  it('clicável é um botão que emite selecionar', async () => {
    const w = montar(DsBlocoAgenda, { props: { ...base, clicavel: true } });
    await w.find('button').trigger('click');
    expect(w.emitted('selecionar')).toHaveLength(1);
  });

  it('sem clicavel não é botão', () => {
    expect(montar(DsBlocoAgenda, { props: base }).find('button').exists()).toBe(
      false,
    );
  });
}
