import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../dados/api.ts';
import { clicarContendo, esperar, montarApp } from '../testes/apoio.ts';

// Atalhos na coluna da agenda (planejamento 0035): + e bloquear já abrem o
// diálogo com o barbeiro da coluna; os botões do topo continuam sem barbeiro.

let app;
beforeEach(() => api.reiniciar());
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

const nomes = () =>
  [...document.querySelectorAll('.coluna__nome')].map((h) =>
    h.textContent.trim(),
  );
const atalho = (rotulo) =>
  document.querySelector(`[aria-label="${rotulo}"]`).closest('button');
const dialogo = () =>
  [...document.querySelectorAll('[role="dialog"]')].at(-1)?.textContent ?? '';

describe('atalhos na coluna da agenda', () => {
  it('+ abre o novo agendamento com o barbeiro da coluna', async () => {
    app = await montarApp('/agenda');
    await esperar(() => expect(nomes().length).toBeGreaterThan(1));
    const segundo = nomes()[1];
    atalho(`Novo agendamento com ${segundo}`).click();
    await esperar(() => expect(dialogo()).toContain(segundo));
  });

  it('o botão do topo segue sem barbeiro escolhido', async () => {
    app = await montarApp('/agenda');
    await esperar(() => expect(nomes().length).toBeGreaterThan(1));
    await clicarContendo('Novo agendamento');
    await esperar(() => expect(dialogo()).toContain('Barbeiro'));
    for (const nome of nomes()) expect(dialogo()).not.toContain(nome);
  });

  it('bloquear abre o bloqueio com o barbeiro da coluna', async () => {
    app = await montarApp('/agenda');
    await esperar(() => expect(nomes().length).toBeGreaterThan(1));
    const segundo = nomes()[1];
    atalho(`Bloquear horário de ${segundo}`).click();
    await esperar(() => expect(dialogo()).toContain(segundo));
  });
});
