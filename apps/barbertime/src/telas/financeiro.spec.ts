import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHAVES_DE_MODULO, CHAVES_DE_PERMISSAO } from '@barbertime/dominio';
import { api } from '../dados/api.ts';
import {
  botoes,
  clicar,
  clicarCelula,
  escolherNoSelect,
  esperar,
  montarApp,
  preencher,
  sessaoCom,
  texto,
} from '../testes/apoio.ts';
import type { AppMontado } from '../testes/apoio.ts';
import type { ContaFin } from '../dados/modelos.ts';

// Planejamento 0027, parte 2, fatia 2A: contas a pagar e a receber,
// categorias e a baixa com dinheiro do caixa.

let app: AppMontado | undefined;
beforeEach(() => api.reiniciar());
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

const menu = () =>
  [...document.querySelectorAll('[aria-label="Menu principal"] a')].map((a) =>
    (a.textContent ?? '').trim(),
  );
const abrirLinha = clicarCelula;

describe('menu e permissões', () => {
  it('com o módulo, Contas, Cadastros e Previsão aparecem no grupo Financeiro', async () => {
    app = await montarApp('/agenda');
    await esperar(() => expect(menu()).toContain('Contas'));
    expect(menu()).toContain('Cadastros');
    expect(menu()).toContain('Previsão');
  });

  it('sem o módulo ou sem financeiro.gerenciar (Recepção), somem', async () => {
    const semModulo = sessaoCom('Dono', [...CHAVES_DE_PERMISSAO], []);
    app = await montarApp('/agenda', { sessao: semModulo });
    await esperar(() => expect(menu()).toContain('Agenda'));
    expect(menu()).not.toContain('Contas');
    app.unmount();
    document.body.innerHTML = '';

    const recepcao = sessaoCom(
      'Recepção',
      ['agenda.ver', 'caixa.operar', 'caixa.abrir'],
      [...CHAVES_DE_MODULO],
    );
    app = await montarApp('/agenda', { sessao: recepcao });
    await esperar(() => expect(menu()).toContain('Agenda'));
    expect(menu()).not.toContain('Contas');
  });
});

describe('contas', () => {
  it('lista as abertas a pagar, filtra as vencidas e troca para a receber', async () => {
    app = await montarApp('/financeiro/contas');
    await esperar(() => expect(texto()).toContain('Aluguel do salão'));
    expect(texto()).toContain('Conta de luz');
    expect(texto()).not.toContain('Aluguel da cadeira');

    await escolherNoSelect('Situação', 'Vencidas');
    await esperar(() => expect(texto()).not.toContain('Aluguel do salão'));
    expect(texto()).toContain('Conta de luz');

    await escolherNoSelect('Tipo', 'A receber');
    await escolherNoSelect('Situação', 'Em aberto');
    await esperar(() => expect(texto()).toContain('Aluguel da cadeira'));
  });

  it('lança uma conta nova a pagar', async () => {
    app = await montarApp('/financeiro/contas');
    await clicar('Nova conta');
    await esperar(() => expect(texto()).toContain('Nova conta a pagar'));
    await preencher('Descrição', 'Internet de novembro');
    await escolherNoSelect('Categoria', 'Internet');
    await preencher('Valor', '129,90');
    await preencher('Vencimento', '2030-01-10');
    await clicar('Lançar');
    await esperar(() => expect(texto()).toContain('Internet de novembro'));
    const [nova] = await api.financeiro.contas
      .listar({ situacao: 'aberta' })
      .then((l) => l.filter((c) => c.descricao === 'Internet de novembro'));
    expect(nova).toMatchObject({ valor: 129.9, categoriaNome: 'Internet' });
  });

  it('pagar com dinheiro do caixa tira da gaveta de hoje', async () => {
    app = await montarApp('/financeiro/contas');
    await esperar(() => expect(texto()).toContain('Conta de luz'));
    abrirLinha('Conta de luz');
    await clicar('Pagar');
    await esperar(() => expect(texto()).toContain('Pagar conta'));
    await escolherNoSelect('Forma de pagamento', 'Dinheiro do caixa');
    await clicar('Confirmar pagamento');
    await esperar(() => expect(texto()).toContain('saiu do caixa de hoje'));
    const caixa = await api.caixa.obterDoDia();
    expect(caixa?.resumo.saidas).toBe(320.45);
  });
});

describe('#30: tela de contas', () => {
  it('#30: resposta atrasada de um filtro antigo não sobrescreve a nova', async () => {
    const original = api.financeiro.contas.listar;
    // Só os campos que a tela de contas mostra.
    const linha = (descricao: string) =>
      ({
        id: descricao.length,
        tipo: 'pagar',
        descricao,
        categoriaNome: 'Aluguel',
        valor: 10,
        vencimento: '2026-11-10',
        situacao: 'aberta',
        situacaoAtual: 'aberta',
      }) as ContaFin;
    api.financeiro.contas.listar = (filtros) =>
      filtros?.situacao === 'aberta'
        ? new Promise<ContaFin[]>((ok) =>
            setTimeout(() => ok([linha('Antiga')]), 1500),
          )
        : Promise.resolve([linha('Nova conta filtrada')]);
    try {
      app = await montarApp('/financeiro/contas');
      await escolherNoSelect('Situação', 'Vencidas');
      await esperar(() => expect(texto()).toContain('Nova conta filtrada'));
      await new Promise((ok) => setTimeout(ok, 1700));
      expect(texto()).toContain('Nova conta filtrada');
      expect(texto()).not.toContain('Antiga');
    } finally {
      api.financeiro.contas.listar = original;
    }
  });

  it('#30: o estorno avisa que o valor volta para o caixa em que saiu', async () => {
    await api.financeiro.contas.baixar(2, { forma: 'dinheiro_caixa' });
    app = await montarApp('/financeiro/contas');
    await escolherNoSelect('Situação', 'Pagas');
    await esperar(() => expect(texto()).toContain('Conta de luz'));
    abrirLinha('Conta de luz');
    await clicar('Estornar');
    await esperar(() => expect(texto()).toContain('caixa em que saiu'));
    expect(texto()).not.toContain('caixa de hoje');
  });
});

describe('categorias', () => {
  it('categoria com conta não mostra "Excluir"; nova categoria entra na lista', async () => {
    app = await montarApp('/financeiro/cadastros');
    await esperar(() => expect(texto()).toContain('Aluguel de cadeira'));
    abrirLinha('Aluguel');
    await esperar(() => expect(texto()).toContain('Editar categoria'));
    expect(botoes('Excluir')).toHaveLength(0);
    await clicar('Cancelar');

    await clicar('Nova categoria');
    await preencher('Nome', 'Marketing');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('Marketing'));
  });
});
