import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../dados/api.ts';
import {
  clicarCelula,
  clicarContendo,
  esperar,
  montarApp,
  normalizar,
  texto,
} from '../testes/apoio.ts';
import type { AppMontado } from '../testes/apoio.ts';

let app: AppMontado | undefined;
beforeEach(() => api.reiniciar());
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

const painel = () =>
  normalizar(
    document.querySelector('section[aria-label="Histórico do cliente"]')
      ?.textContent ?? '',
  );
const comandasListadas = () =>
  document.querySelectorAll('ul[aria-label="Comandas do cliente"] li').length;

async function abrirRafael() {
  app = await montarApp('/clientes');
  await esperar(() => expect(texto()).toContain('Rafael Souza'));
  clicarCelula('Rafael Souza');
  await esperar(() => expect(painel()).toContain('Em serviços'));
}

describe('cadastro do cliente com histórico (planejamento 0016)', () => {
  it('Resumo: total em serviços, em produtos, total gasto e último serviço', async () => {
    await abrirRafael();
    expect(painel()).toMatch(/Em serviços\s*R\$ 390,00/);
    expect(painel()).toMatch(/Em produtos\s*R\$ 74,80/);
    expect(painel()).toMatch(/Total gasto\s*R\$ 459,90/);
    expect(painel()).toMatch(/Último serviço\s*Corte \+ barba/);
    expect(painel()).toContain('Zé Carlos');
  });

  it('Comandas: 5 primeiro, "Ver mais" traz o resto e some no fim', async () => {
    await abrirRafael();
    document.querySelectorAll<HTMLElement>('[role="tab"]')[1]?.click();
    await esperar(() => expect(comandasListadas()).toBe(5));
    expect(painel()).toContain('Comandas (7)');
    expect(painel()).toContain('Corte, Pomada modeladora');
    await clicarContendo('Ver mais (2)');
    await esperar(() => expect(comandasListadas()).toBe(7));
    expect(painel()).not.toContain('Ver mais');
  });

  it('Agendamentos continua disponível na terceira aba', async () => {
    await abrirRafael();
    document.querySelectorAll<HTMLElement>('[role="tab"]')[2]?.click();
    await esperar(() =>
      expect(
        document.querySelectorAll('ul[aria-label="Agendamentos do cliente"] li')
          .length,
      ).toBeGreaterThan(0),
    );
  });

  it('cliente novo: só o formulário, sem o painel de histórico', async () => {
    app = await montarApp('/clientes');
    await clicarContendo('Novo cliente');
    await esperar(() => expect(texto()).toContain('Observações'));
    expect(
      document.querySelector('section[aria-label="Histórico do cliente"]'),
    ).toBeNull();
  });
});
