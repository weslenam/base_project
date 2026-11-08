import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../dados/api.js';
import {
  clicar,
  clicarContendo,
  escolherNoSelect,
  esperar,
  montarApp,
  preencher,
  sessaoCom,
  texto,
} from '../testes/apoio.js';
import { CHAVES_DE_PERMISSAO } from '@barbertime/dominio';

let app;
beforeEach(() => api.reiniciar());
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

const normalizar = (t) => t.replace(/\s/g, ' ');
const menu = () =>
  [...document.querySelectorAll('[aria-label="Menu principal"] a')].map((a) =>
    a.textContent.trim(),
  );

describe('módulos no menu', () => {
  it('Pacotes e Fidelidade aparecem com os módulos ativos', async () => {
    app = await montarApp('/agenda');
    await esperar(() => expect(menu()).toContain('Pacotes'));
    expect(menu()).toContain('Fidelidade');
  });

  it('sem os módulos (serviço adicional não contratado), somem do menu', async () => {
    const semModulos = sessaoCom(
      'Dono',
      [...CHAVES_DE_PERMISSAO],
      ['agendamento_online'],
    );
    app = await montarApp('/agenda', { sessao: semModulos });
    await esperar(() => expect(menu()).toContain('Agenda'));
    expect(menu()).not.toContain('Pacotes');
    expect(menu()).not.toContain('Fidelidade');
  });
});

describe('configuração', () => {
  it('Pacotes lista quantidade, vigência e limite de uso', async () => {
    app = await montarApp('/pacotes');
    await esperar(() => expect(texto()).toContain('Clube do corte'));
    const t = normalizar(texto());
    expect(t).toContain('livre × Corte + livre × Barba');
    expect(t).toContain('Mensal, renovável');
    expect(t).toContain('a cada 7 dias');
    expect(t).toContain('4 × Corte');
    expect(t).toContain('até 1× por semana');
    expect(t).toContain('R$ 99,90/mês');
  });

  it('Fidelidade: configuração inválida é negada', async () => {
    app = await montarApp('/fidelidade');
    await esperar(() => expect(texto()).toContain('Cartão de selos'));
    await preencher('Cashback (%)', '80');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('entre 0,1% e 50%'));
  });
});

describe('no cliente', () => {
  it('mostra selos, cashback e pacotes em vigor', async () => {
    app = await montarApp('/clientes');
    await esperar(() => expect(texto()).toContain('Diego Alves'));
    [...document.querySelectorAll('td')]
      .find((td) => td.textContent.trim() === 'Diego Alves')
      .click();
    await esperar(() => expect(texto()).toContain('Clube do corte'));
    expect(texto()).toContain('Em vigor até');
    expect(texto()).toContain('Barba: livre (1 uso)');
  });
});

describe('na comanda', () => {
  it('usar o pacote: serviço por R$ 0; repetir antes do intervalo é negado', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Diego Alves');
    await clicarContendo('Abrir comanda');
    await esperar(() => expect(texto()).toMatch(/Comanda #\d+/));
    await escolherNoSelect('Escolher serviço', 'Corte ·');
    await esperar(() =>
      expect(texto()).toContain('Usar o pacote Clube do corte'),
    );
    const caixa = [
      ...document.querySelectorAll('.v-dialog input[type="checkbox"]'),
    ][0];
    expect(caixa.checked).toBe(true);
    await clicar('Incluir');
    await esperar(() => expect(texto()).toContain('Corte (pacote)'));

    await escolherNoSelect('Escolher serviço', 'Corte ·');
    await esperar(() =>
      expect(texto()).toContain('Usar o pacote Clube do corte'),
    );
    await clicar('Incluir');
    await esperar(() =>
      expect(texto()).toContain('Próximo uso de Corte liberado'),
    );
  });

  it('receber credita selo e cashback, e a notificação conta ao balcão', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Rafael Souza');
    await clicarContendo('Abrir comanda');
    await esperar(() => expect(texto()).toContain('7 selos'));
    await clicar('Pix');
    await clicarContendo('Receber R');
    await esperar(() =>
      expect(normalizar(texto())).toContain(
        'Cliente ganhou +1 selo e +R$ 3,50 de cashback',
      ),
    );
    expect(await api.fidelidade.saldo(1)).toMatchObject({
      selos: 8,
      cashback: 7,
    });
  });
});
