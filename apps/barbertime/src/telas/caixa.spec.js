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

const normalizar = (t) => t.replace(/\s/g, ' ');
const abrirLinha = (trecho) =>
  [...document.querySelectorAll('td')]
    .find((td) => td.textContent.includes(trecho))
    .click();

describe('caixa', () => {
  it('mostra o resumo do dia por forma de pagamento e as comandas', async () => {
    app = await montarApp('/caixa');
    await esperar(() => expect(texto()).toContain('Recebido hoje'));
    expect(normalizar(texto())).toContain('R$ 130,00');
    expect(normalizar(texto())).toContain('R$ 170,00'); // na gaveta: 100 de troco + 70 em dinheiro
    expect(texto()).toContain('Cliente avulso');
  });

  it('receber sem forma de pagamento é negado', async () => {
    app = await montarApp('/caixa');
    await esperar(() => expect(texto()).toContain('Cliente avulso'));
    abrirLinha('Cliente avulso');
    await esperar(() => expect(texto()).toContain('Comanda #3'));
    await clicarContendo('Receber');
    await esperar(() =>
      expect(texto()).toContain('Escolha a forma de pagamento.'),
    );
  });

  it('fechar com comanda em aberto é negado', async () => {
    app = await montarApp('/caixa');
    await clicar('Fechar caixa');
    await preencher('Dinheiro contado na gaveta', '17000');
    await clicar('Fechar caixa', { ultimo: true });
    await esperar(() => expect(texto()).toContain('Há 1 comanda em aberto'));
  });

  it('diferença no dinheiro passa pela advertência e fica registrada', async () => {
    await api.comandas.cancelar(3);
    app = await montarApp('/caixa');
    await clicar('Fechar caixa');
    await preencher('Dinheiro contado na gaveta', '16500');
    await clicar('Fechar caixa', { ultimo: true });
    await esperar(() => {
      expect(texto()).toContain('Atenção');
      expect(normalizar(texto())).toContain('Faltam R$ 5,00');
    });
    await clicar('Fechar com diferença');
    await esperar(() => expect(texto()).toContain('Caixa fechado às'));
    expect(normalizar(texto())).toContain('Faltaram R$ 5,00');
  });
});

describe('agenda → comanda', () => {
  it('agendamento confirmado abre a comanda com o serviço', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Rafael Souza');
    await clicar('Abrir comanda');
    await esperar(() => expect(texto()).toContain('Comanda #4'));
    expect(texto()).toContain('Corte + barba');
    expect(normalizar(texto())).toContain('Receber R$ 70,00');
  });
});
