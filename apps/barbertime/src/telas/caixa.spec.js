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

describe('comanda com abas e pagamento estilo PDV', () => {
  const painelVisivel = () =>
    [...document.querySelectorAll('[role="tabpanel"]')].find(
      (p) => p.style.display !== 'none',
    );
  const resumo = () =>
    normalizar(
      document.querySelector('section[aria-label="Pagamento"]').textContent,
    );

  it('separa serviços e produtos em abas, cada uma com seu total', async () => {
    app = await montarApp('/caixa');
    await esperar(() => expect(texto()).toContain('Diego Alves'));
    abrirLinha('Diego Alves');
    await esperar(() => expect(texto()).toContain('Comanda #2'));
    const abas = [...document.querySelectorAll('[role="tab"]')].map((t) =>
      t.textContent.trim(),
    );
    expect(abas).toEqual(['Serviços (1)', 'Produtos (1)']);

    expect(painelVisivel().textContent).toContain('Barba');
    expect(normalizar(painelVisivel().textContent)).toContain(
      'Total em serviços',
    );
    expect(painelVisivel().textContent).not.toContain('Óleo para barba');

    document.querySelectorAll('[role="tab"]')[1].click();
    await esperar(() =>
      expect(painelVisivel().textContent).toContain('Óleo para barba'),
    );
    expect(normalizar(painelVisivel().textContent)).toContain(
      'Total em produtos',
    );

    expect(resumo()).toMatch(/Serviços\s*R\$ 30,00/);
    expect(resumo()).toMatch(/Produtos\s*R\$ 34,90/);
    expect(resumo()).toMatch(/Total\s*R\$ 60,00/);
  });

  it('receber escolhendo a forma de pagamento com um toque', async () => {
    app = await montarApp('/caixa');
    await esperar(() => expect(texto()).toContain('Cliente avulso'));
    abrirLinha('Cliente avulso');
    await esperar(() => expect(texto()).toContain('Comanda #3'));
    await clicar('Pix');
    await esperar(() => expect(texto()).toContain('Em Pix · fecha a comanda'));
    await clicarContendo('Receber R');
    await esperar(() =>
      expect(normalizar(texto())).toContain('Recebido R$ 39,90 em Pix'),
    );
  });
});

describe('agenda → comanda', () => {
  it('agendamento confirmado abre a comanda com o serviço', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Rafael Souza');
    await clicarContendo('Abrir comanda');
    await esperar(() => expect(texto()).toMatch(/Comanda #\d+/));
    expect(texto()).toContain('Corte + barba');
    expect(normalizar(texto())).toContain('Receber R$ 70,00');
  });
});
