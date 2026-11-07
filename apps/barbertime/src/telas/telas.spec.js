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
    for (const t of [
      'Clientes',
      'Equipe',
      'Serviços',
      'Produtos',
      'Página pública',
    ]) {
      expect(texto()).toContain(t);
    }
  });

  it('página pública não mostra o menu interno', async () => {
    app = await montarApp('/agendar/barbearia-modelo');
    await esperar(() => expect(texto()).toContain('Barbearia do Zé'));
    expect(texto()).not.toContain('Produtos');
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
    await clicarContendo('Cancelar agendamento');
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

describe('detalhe do agendamento (estilo PDV)', () => {
  const acoes = () =>
    [...document.querySelectorAll('section[aria-label="Ações"] button')].map(
      (b) => b.textContent.trim(),
    );

  it('informações de um lado, ações do outro, conforme o estado', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Rafael Souza');
    await esperar(() => expect(acoes()).toHaveLength(4));
    for (const t of [
      'Marcar atendido',
      'Abrir comanda',
      'Marcar falta',
      'Cancelar agendamento',
    ]) {
      expect(acoes().some((a) => a.startsWith(t))).toBe(true);
    }
    const info = document.querySelector(
      'section[aria-label="Informações do agendamento"]',
    );
    expect(info.textContent).toContain('Prefere máquina 2');
    expect(info.textContent).toContain('09:00–09:50');
  });

  it('pendente mostra só confirmar e cancelar', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Bruno Lima');
    await esperar(() => expect(acoes()).toHaveLength(2));
    expect(acoes()[0].startsWith('Confirmar presença')).toBe(true);
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

describe('equipe', () => {
  it('lista os barbeiros e recusa tirar da equipe quem tem agendamento futuro', async () => {
    app = await montarApp('/equipe');
    await esperar(() => expect(texto()).toContain('Léo'));
    expect(texto()).not.toContain('Pigmentação');
    [...document.querySelectorAll('td')]
      .find((td) => td.textContent.trim() === 'Léo')
      .click();
    await esperar(() => expect(campo('Nome')?.value).toBe('Léo'));
    await clicar('Tirar da equipe');
    await clicar('Tirar da equipe', { ultimo: true });
    await esperar(() =>
      expect(texto()).toContain('Não é possível excluir "Léo"'),
    );
  });
});

describe('produtos', () => {
  it('lista os produtos e nega nome repetido', async () => {
    app = await montarApp('/produtos');
    await esperar(() => expect(texto()).toContain('Pomada modeladora'));
    await clicar('Novo produto');
    await preencher('Nome', 'Pomada Modeladora');
    await preencher('Preço de venda', '2990');
    await clicar('Salvar');
    await esperar(() =>
      expect(texto()).toContain(
        'Já existe um produto chamado "Pomada modeladora"',
      ),
    );
  });

  it('cadastra produto novo', async () => {
    app = await montarApp('/produtos');
    await clicar('Novo produto');
    await preencher('Nome', 'Balm pós-barba');
    await preencher('Preço de venda', '3200');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('Balm pós-barba cadastrado'));
    await esperar(() =>
      expect(
        [...document.querySelectorAll('td')].some((td) =>
          td.textContent.replace(/\s/g, ' ').includes('R$ 32,00'),
        ),
      ).toBe(true),
    );
  });
});

describe('serviços', () => {
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
  const etapaAtual = () =>
    document
      .querySelector(
        '[aria-label="Etapas do agendamento"] [aria-current="step"]',
      )
      ?.textContent.trim();
  const resumo = () =>
    document.querySelector('[aria-label="Suas escolhas"]')?.textContent.trim();

  it('uma etapa por vez: escolher avança, o resumo acompanha e Voltar retorna', async () => {
    app = await montarApp('/agendar/barbearia-modelo');
    await esperar(() => expect(etapaAtual()).toBe('1Serviço'));
    expect(texto()).not.toContain('Com quem?');

    await clicarContendo('30 min');
    await esperar(() => expect(etapaAtual()).toBe('2Barbeiro'));
    expect(resumo()).toBe('Corte');
    expect(texto()).not.toContain('Qual serviço?');

    await clicarContendo('Marcos');
    await esperar(() => expect(etapaAtual()).toBe('3Dia'));
    expect(resumo()).toBe('Corte · Marcos');

    await clicarContendo('Voltar');
    await esperar(() => expect(etapaAtual()).toBe('2Barbeiro'));
    // Etapa concluída vira botão para voltar direto a ela.
    document.querySelector('button[aria-label="Voltar para Serviço"]').click();
    await esperar(() => expect(etapaAtual()).toBe('1Serviço'));
    expect(texto()).toContain('Qual serviço?');
  });

  /** Percorre as etapas até "Seus dados" (Corte · Marcos · Amanhã · primeiro horário). */
  async function ateSeusDados() {
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
    await esperar(() => expect(etapaAtual()).toBe('5Seus dados'));
  }

  it('cliente novo: telefone primeiro, boas-vindas, nome e reservado', async () => {
    await ateSeusDados();
    await preencher('Seu WhatsApp ou celular', '11955554444');
    await esperar(() => expect(texto()).toContain('Primeira vez por aqui?'));
    await preencher('Seu nome', 'Carlos Novo');
    await clicar('Confirmar horário');
    await esperar(() => expect(texto()).toContain('Horário reservado'));
    expect(texto()).toContain('Carlos, seu horário é');
    expect(await api.clientes.listar({ busca: 'Carlos Novo' })).toHaveLength(1);
  });

  it('cliente que volta: saudação pelo primeiro nome e confirma sem digitar o nome', async () => {
    await ateSeusDados();
    await preencher('Seu WhatsApp ou celular', '11987654321');
    await esperar(() => expect(texto()).toContain('Olá, Rafael!'));
    expect(texto()).not.toContain('Souza'); // só o primeiro nome (LGPD)
    expect(texto()).not.toContain('Primeira vez por aqui?');
    await clicar('Confirmar horário');
    await esperar(() => expect(texto()).toContain('Rafael, seu horário é'));
    expect(await api.clientes.listar({ busca: 'Rafael' })).toHaveLength(1);
  });

  it('"Não é você?" limpa o número para usar outro', async () => {
    await ateSeusDados();
    await preencher('Seu WhatsApp ou celular', '11987654321');
    await esperar(() => expect(texto()).toContain('Olá, Rafael!'));
    await clicarContendo('Não é você?');
    await esperar(() => expect(texto()).not.toContain('Olá, Rafael!'));
  });

  it('cartão "Seu agendamento" mostra as escolhas e o valor', async () => {
    await ateSeusDados();
    const cartao = document.querySelector(
      'aside[aria-label="Seu agendamento"]',
    ).textContent;
    expect(cartao.replace(/\s/g, ' ')).toMatch(
      /Corte.*30 min.*Marcos.*Amanhã.*R\$ 45,00/,
    );
  });
});
