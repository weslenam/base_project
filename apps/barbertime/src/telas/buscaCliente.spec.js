import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../dados/api.js';
import {
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

const botoesResultado = () => [
  ...document.querySelectorAll('ul[aria-label="Clientes encontrados"] button'),
];
const resultados = () =>
  botoesResultado().map((b) => b.textContent.replace(/\s/g, ' ').trim());
/** Clica no resultado da busca (não em outro botão com o mesmo nome atrás do diálogo). */
const escolherResultado = (nome) =>
  botoesResultado()
    .find((b) => b.textContent.includes(nome))
    .click();

describe('busca de cliente pelo telefone', () => {
  it('na comanda: os últimos 4 dígitos acham o cliente; um toque escolhe', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await preencher('Telefone do cliente', '4321');
    // Vários telefones de exemplo contêm "4321"; quem termina com eles vem primeiro.
    await esperar(() => expect(resultados()[0]).toContain('Rafael Souza'));
    expect(resultados().length).toBeLessThanOrEqual(5);
    escolherResultado('Rafael Souza');
    await esperar(() => expect(texto()).toContain('Trocar'));
    expect(texto()).not.toContain('Telefone do cliente');
  });

  it('número completo sem cadastro: cadastra com o nome e já usa', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await preencher('Telefone do cliente', '11977776666');
    await esperar(() =>
      expect(texto()).toContain('Nenhum cliente com o telefone'),
    );
    await preencher('Nome do cliente', 'Cliente Balcão');
    await clicar('Cadastrar e usar');
    await esperar(() => expect(texto()).toContain('Cliente Balcão cadastrado'));
    expect(texto()).toContain('Trocar');
    expect((await api.clientes.listar({ busca: '11977776666' }))[0].nome).toBe(
      'Cliente Balcão',
    );
  });

  it('na comanda, avulso continua possível e explícito', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await esperar(() =>
      expect(texto()).toContain('Sem cliente, a comanda fica como avulso'),
    );
  });

  it('no novo agendamento: acha pelo telefone e avisa das faltas', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Novo agendamento');
    await preencher('Telefone do cliente', '3210');
    await esperar(() => expect(resultados()[0]).toContain('Bruno Lima'));
    escolherResultado('Bruno Lima');
    await esperar(() => expect(texto()).toContain('1 falta'));
  });
});
