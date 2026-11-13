import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../dados/api.ts';
import {
  clicar,
  clicarCelula,
  clicarContendo,
  escolherNoSelect,
  esperar,
  montarApp,
  normalizar,
  preencher,
  sessaoCom,
  texto,
} from '../testes/apoio.ts';
import type { AppMontado } from '../testes/apoio.ts';
import { CHAVES_DE_PERMISSAO, permissoesDoPapel } from '@barbertime/dominio';
import router from '../router';

let app: AppMontado | undefined;
beforeEach(() => api.reiniciar());
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

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
    clicarCelula('Diego Alves');
    await esperar(() => expect(texto()).toContain('Clube do corte'));
    expect(texto()).toContain('Em vigor até');
    expect(texto()).toContain('Barba: livre (1 uso)');
  });
});

describe('renovar o pacote mensal (planejamento 0034, etapa B)', () => {
  it('"Renovar" abre a comanda no caixa e o pacote mostra a renovação pendente', async () => {
    app = await montarApp('/clientes');
    await esperar(() => expect(texto()).toContain('Diego Alves'));
    clicarCelula('Diego Alves');
    await esperar(() => expect(texto()).toContain('Clube do corte'));
    await clicar('Renovar');
    await esperar(() => expect(texto()).toContain('Renovar pacote'));
    expect(texto()).toContain('O novo mês começa em');
    await escolherNoSelect('Quem vendeu', 'Marcos');
    await clicar('Renovar e ir para o caixa');
    await esperar(() => expect(router.currentRoute.value.path).toBe('/caixa'));
    const [clube] = await api.assinaturas.doCliente(3);
    expect(clube.renovacao).toBe('aguardando_pagamento');
  });

  it('sem pacotes.vender, o botão "Renovar" não aparece', async () => {
    const semVender = sessaoCom(
      'Gerente',
      CHAVES_DE_PERMISSAO.filter((p) => p !== 'pacotes.vender'),
      ['agendamento_online', 'fidelidade', 'pacotes'],
    );
    app = await montarApp('/clientes', { sessao: semVender });
    await esperar(() => expect(texto()).toContain('Diego Alves'));
    clicarCelula('Diego Alves');
    await esperar(() => expect(texto()).toContain('Clube do corte'));
    expect(
      [...document.querySelectorAll('button')].some(
        (b) => b.textContent.trim() === 'Renovar',
      ),
    ).toBe(false);
  });
});

describe('na comanda', () => {
  it('usar o pacote: serviço por R$ 0; repetir antes do intervalo é negado', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Diego Alves');
    await clicarContendo('Confirmar presença');
    await esperar(() => expect(texto()).toMatch(/Comanda #\d+/));
    await escolherNoSelect('Escolher serviço', 'Corte ·');
    await esperar(() =>
      expect(texto()).toContain('Usar o pacote Clube do corte'),
    );
    const caixa = [
      ...document.querySelectorAll<HTMLInputElement>(
        '.v-dialog input[type="checkbox"]',
      ),
    ][0];
    expect(caixa?.checked).toBe(true);
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

  it('usar cashback abate do total e o saldo é gasto ao receber (planejamento 0034)', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Rafael Souza');
    await clicarContendo('Confirmar presença');
    await esperar(() => expect(texto()).toContain('Usar cashback (até R$'));
    expect(normalizar(texto())).toContain('7 de 10 selos');
    await preencher('Usar cashback (até R$\u00a03,50)', '3,50');
    await esperar(() =>
      expect(normalizar(texto())).toMatch(/Cashback\s*−\s*R\$\s3,50/),
    );
    await clicar('Pix');
    await clicarContendo('Receber R');
    await esperar(() => expect(normalizar(texto())).toContain('Recebido'));
    // 3,50 gastos; o cashback novo incide só sobre o que foi pago.
    const saldo = await api.fidelidade.saldo(1);
    expect(saldo.selos).toBe(8);
    expect(saldo.cashback).toBeLessThan(3.5);
    // Planejamento 0037: o resumo do caixa mostra o cashback numa linha própria.
    await esperar(() =>
      expect(normalizar(texto())).toMatch(/Cashback usado\s*R\$\s3,50/),
    );
  });

  // Planejamento 0037/0043: o Barbeiro não tem a tela Caixa; confirmar presença abre a comanda na Agenda.
  it('Barbeiro: confirmar presença abre a comanda na própria Agenda', async () => {
    app = await montarApp('/agenda', {
      sessao: sessaoCom('Barbeiro', permissoesDoPapel('barbeiro')),
    });
    await clicarContendo('Rafael Souza');
    await clicarContendo('Confirmar presença');
    await esperar(() => expect(texto()).toContain('Salvar aberta'));
    expect(router.currentRoute.value.path).toBe('/agenda');
  });

  it('receber credita selo e cashback, e a notificação conta ao balcão', async () => {
    app = await montarApp('/agenda');
    await clicarContendo('Rafael Souza');
    await clicarContendo('Confirmar presença');
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
