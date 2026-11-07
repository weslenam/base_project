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

const CAMPO = 'Nome ou telefone do cliente';
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
const escolhido = () => document.querySelector('.escolhido')?.textContent ?? '';

describe('busca de cliente por nome ou telefone', () => {
  it('telefone: os últimos 4 dígitos acham o cliente; um toque escolhe', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await preencher(CAMPO, '4321');
    // Vários telefones de exemplo contêm "4321"; quem termina com eles vem primeiro.
    await esperar(() => expect(resultados()[0]).toContain('Rafael Souza'));
    expect(resultados().length).toBeLessThanOrEqual(5);
    escolherResultado('Rafael Souza');
    await esperar(() => expect(escolhido()).toContain('Rafael Souza'));
  });

  it('nome: parte do nome acha o cliente; quem começa com o texto vem primeiro', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await preencher(CAMPO, 'gus');
    await esperar(() => expect(resultados()[0]).toContain('Gustavo Rocha'));
    escolherResultado('Gustavo Rocha');
    await esperar(() => expect(escolhido()).toContain('Gustavo Rocha'));
  });

  it('telefone sem cadastro: o número já vem preenchido, falta só o nome', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await preencher(CAMPO, '11977776666');
    await esperar(() => expect(texto()).toContain('Cadastre agora'));
    await preencher('Nome do cliente', 'Cliente Balcão');
    await clicar('Cadastrar e usar');
    await esperar(() => expect(escolhido()).toContain('Cliente Balcão'));
    expect((await api.clientes.listar({ busca: '11977776666' }))[0].nome).toBe(
      'Cliente Balcão',
    );
  });

  it('nome sem cadastro: o nome já vem preenchido, falta só o telefone', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await preencher(CAMPO, 'Joaquim Novo');
    await esperar(() => expect(texto()).toContain('Cadastre agora'));
    await preencher('Telefone', '11966665555');
    await clicar('Cadastrar e usar');
    await esperar(() => expect(escolhido()).toContain('Joaquim Novo'));
  });

  it('"Procurar na lista" abre todos os clientes; clicar escolhe', async () => {
    app = await montarApp('/caixa');
    await clicarContendo('Nova comanda');
    await clicarContendo('Procurar na lista');
    await esperar(() => expect(texto()).toContain('Escolher cliente'));
    await esperar(() =>
      expect(
        [...document.querySelectorAll('td')].some(
          (td) => td.textContent.trim() === 'Thiago Costa',
        ),
      ).toBe(true),
    );
    [...document.querySelectorAll('td')]
      .find((td) => td.textContent.trim() === 'Thiago Costa')
      .click();
    await esperar(() => expect(escolhido()).toContain('Thiago Costa'));
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
    await preencher(CAMPO, '3210');
    await esperar(() => expect(resultados()[0]).toContain('Bruno Lima'));
    escolherResultado('Bruno Lima');
    await esperar(() => expect(escolhido()).toContain('1 falta'));
  });
});
