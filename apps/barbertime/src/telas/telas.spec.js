import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../dados/api.js';
import {
  campo,
  clicar,
  clicarContendo,
  esperar,
  montarApp,
  preencher,
  texto,
} from '../testes/apoio.js';

let app;
beforeEach(() => api.reiniciar());
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

describe('layout e rotas', () => {
  it('/ abre a agenda, com o menu do app', async () => {
    app = await montarApp('/');
    await esperar(() => expect(texto()).toContain('Zé Carlos'));
    for (const t of ['Clientes', 'Serviços e equipe', 'Página pública'])
      expect(texto()).toContain(t);
  });

  it('página pública não mostra o menu interno', async () => {
    app = await montarApp('/agendar/barbearia-modelo');
    await esperar(() => expect(texto()).toContain('Barbearia do Zé'));
    expect(texto()).not.toContain('Serviços e equipe');
    expect(texto()).toContain('Agendamento por BarberTime');
  });
});

describe('agenda do dia', () => {
  it('mostra uma coluna por barbeiro com os agendamentos', async () => {
    app = await montarApp('/agenda');
    await esperar(() => {
      expect(texto()).toContain('Rafael Souza');
      expect(texto()).toContain('Almoço');
    });
    expect(
      document.querySelectorAll('section[aria-label^="Agenda de"]'),
    ).toHaveLength(3);
  });

  it('cancelar agendamento confirmado passa pela advertência', async () => {
    app = await montarApp('/agenda');
    await esperar(() => expect(texto()).toContain('Rafael Souza'));
    await clicarContendo('Rafael Souza');
    await clicar('Cancelar');
    await esperar(() => {
      expect(texto()).toContain('Atenção');
      expect(texto()).toContain('já confirmou presença');
    });
    await clicar('Cancelar agendamento');
    await esperar(() => expect(texto()).toContain('Agendamento cancelado'));
    await esperar(() =>
      expect(
        [...document.querySelectorAll('button')].some((b) =>
          b.textContent.includes('Rafael Souza'),
        ),
      ).toBe(false),
    );
  });
});

describe('clientes', () => {
  it('lista com busca', async () => {
    app = await montarApp('/clientes');
    await esperar(() => expect(texto()).toContain('Thiago Costa'));
    await preencher('Buscar', 'rafa');
    await esperar(() => expect(texto()).not.toContain('Thiago Costa'));
    expect(texto()).toContain('Rafael Souza');
  });

  it('telefone repetido é negado citando o dono do número', async () => {
    app = await montarApp('/clientes');
    await clicar('Novo cliente');
    await preencher('Nome', 'Rafael Clone');
    await preencher('Telefone', '11987654321');
    await clicar('Salvar');
    await esperar(() => {
      expect(texto()).toContain('Não foi possível');
      expect(texto()).toContain('já está no cadastro de Rafael Souza');
    });
  });
});

describe('serviços e equipe', () => {
  it('excluir serviço com agendamentos futuros é negado', async () => {
    app = await montarApp('/servicos');
    await esperar(() => expect(texto()).toContain('Pigmentação'));
    [...document.querySelectorAll('td')]
      .find((td) => td.textContent.trim() === 'Pigmentação')
      .click();
    await esperar(() => expect(campo('Nome')?.value).toBe('Pigmentação'));
    await clicar('Excluir');
    await esperar(() =>
      expect(texto()).toContain('Excluir o serviço "Pigmentação"?'),
    );
    await clicar('Excluir', { ultimo: true });
    await esperar(() => expect(texto()).toContain('há 1 agendamento futuro'));
  });
});

describe('agendamento público', () => {
  it('serviço → barbeiro → dia → horário → dados → reservado', async () => {
    app = await montarApp('/agendar/barbearia-modelo');
    await esperar(() => expect(texto()).toContain('Corte + barba'));
    await clicarContendo('30 min');
    await clicarContendo('Marcos');
    await clicar('Amanhã');
    await esperar(() =>
      expect(
        document.querySelector('[role="group"][aria-label="Horários livres"]'),
      ).toBeTruthy(),
    );
    document
      .querySelector('[role="group"][aria-label="Horários livres"] button')
      .click();
    await preencher('Seu nome', 'Carlos Novo');
    await preencher('WhatsApp ou celular', '11955554444');
    await clicar('Confirmar horário');
    await esperar(() => expect(texto()).toContain('Horário reservado'));
    expect(texto()).toContain('Carlos Novo, seu horário é');
    expect(await api.clientes.listar({ busca: 'Carlos Novo' })).toHaveLength(1);
  });
});
