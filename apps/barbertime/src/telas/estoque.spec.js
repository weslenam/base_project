import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { CHAVES_DE_MODULO, CHAVES_DE_PERMISSAO } from '@barbertime/dominio';
import { api } from '../dados/api.js';
import {
  botoes,
  campo,
  clicar,
  clicarContendo,
  escolherNoSelect,
  esperar,
  montarApp,
  preencher,
  sessaoCom,
  texto,
} from '../testes/apoio.js';

// Planejamento 0027 (parte 1): estoque, fornecedores, compras e ficha técnica.

let app;
beforeEach(() => api.reiniciar());
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

const menu = () =>
  [...document.querySelectorAll('[aria-label="Menu principal"] a')].map((a) =>
    a.textContent.trim(),
  );
const normalizado = () => texto().replace(/\s/g, ' ');
const celulas = () =>
  [...document.querySelectorAll('td')].map((td) =>
    td.textContent.replace(/\s/g, ' ').trim(),
  );
const linhaCom = (trecho) =>
  [...document.querySelectorAll('td')].find(
    (td) => td.textContent.trim() === trecho,
  );

describe('menu e permissões', () => {
  it('com o módulo, Estoque, Compras e Fornecedores aparecem', async () => {
    app = await montarApp('/agenda');
    await esperar(() => expect(menu()).toContain('Estoque'));
    expect(menu()).toEqual(expect.arrayContaining(['Compras', 'Fornecedores']));
  });

  it('sem o módulo, somem do menu', async () => {
    const sessao = sessaoCom('Dono', [...CHAVES_DE_PERMISSAO], []);
    app = await montarApp('/agenda', { sessao });
    await esperar(() => expect(menu()).toContain('Agenda'));
    expect(menu()).not.toContain('Estoque');
    expect(menu()).not.toContain('Compras');
  });

  it('a Recepção vê o estoque mas não movimenta', async () => {
    const sessao = sessaoCom(
      'Recepção',
      ['agenda.ver', 'caixa.operar', 'estoque.ver'],
      [...CHAVES_DE_MODULO],
    );
    app = await montarApp('/estoque', { sessao });
    await esperar(() => expect(texto()).toContain('Pomada modeladora'));
    expect(botoes('Registrar consumo')).toHaveLength(0);
    expect(botoes('Inventário')).toHaveLength(0);
  });
});

describe('produtos', () => {
  it('consumível não pede preço e aparece com saldo na lista', async () => {
    app = await montarApp('/produtos');
    await clicar('Novo produto');
    await preencher('Nome', 'Gel de barbear');
    await clicarContendo('Consumível');
    await flushPromises();
    expect(campo('Preço de venda')).toBeFalsy();
    expect(texto()).toContain('Uso interno');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('Gel de barbear cadastrado'));
    const p = (await api.produtos.listar()).find(
      (x) => x.nome === 'Gel de barbear',
    );
    expect(p).toMatchObject({ tipo: 'consumivel', preco: null, comissao: 0 });
    await esperar(() => expect(celulas()).toContain('Consumível'));
    expect(texto()).toContain('Saldo');
  });

  it('comanda paga baixa o estoque (revenda e ficha técnica)', async () => {
    const gel = await api.produtos.salvar({
      nome: 'Gel',
      tipo: 'consumivel',
      unidade: 'ml',
    });
    await api.fichas.salvar(1, [{ produtoId: gel.id, quantidade: 10 }]);
    await api.caixa.abrir({ valorInicial: 0 }).catch(() => undefined);
    const cm = await api.comandas.salvar({
      barbeiroId: 1,
      itens: [
        { tipo: 'servico', refId: 1 },
        { tipo: 'produto', refId: 1, quantidade: 2 },
      ],
    });
    await api.comandas.receber(cm.id, { forma: 'pix' });
    const { produtos } = await api.estoque.obter();
    expect(produtos.find((p) => p.id === gel.id).saldo).toBe(-10);
    expect(produtos.find((p) => p.id === 1).saldo).toBe(4);
  });
});

describe('estoque', () => {
  it('mostra "Comprar", registra consumo e faz inventário', async () => {
    app = await montarApp('/estoque');
    await esperar(() => expect(texto()).toContain('Comprar'));
    // Óleo: saldo 1 com mínimo 2 → comprar 3.
    expect(texto()).toContain('No mínimo');
    expect(normalizado()).toContain('comprar 3 un');

    await clicar('Registrar consumo');
    await escolherNoSelect('Produto', 'Pomada modeladora');
    await preencher('Quantidade', '2');
    await preencher('Motivo', 'Amostra');
    await clicar('Registrar');
    await esperar(() =>
      expect(texto()).toContain('Consumo de Pomada modeladora registrado'),
    );
    await esperar(() => expect(celulas()).toContain('4 un'));

    await clicar('Inventário');
    await preencher('Contado de Pomada modeladora', '10');
    await clicar('Salvar inventário');
    // A notificação anterior ainda ocupa o aviso: confere pelo saldo.
    await esperar(() => expect(celulas()).toContain('10 un'));

    linhaCom('Pomada modeladora').click();
    await esperar(() =>
      expect(texto()).toContain('Movimentos de Pomada modeladora'),
    );
    await esperar(() => expect(celulas()).toContain('Inventário'));
    expect(celulas()).toContain('Consumo manual');
    expect(celulas()).toContain('+6 un');
  });
});

describe('fornecedores', () => {
  it('nega CNPJ inválido e cadastra o válido', async () => {
    app = await montarApp('/fornecedores');
    await esperar(() => expect(texto()).toContain('Distribuidora Navalha'));
    await clicar('Novo fornecedor');
    await preencher('Nome', 'Barba Forte Ltda');
    await preencher('CPF ou CNPJ', '11.222.333/0001-80');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('CPF ou CNPJ inválido'));
    await preencher('CPF ou CNPJ', '11.444.777/0001-61');
    await clicar('Salvar');
    await esperar(() =>
      expect(texto()).toContain('Barba Forte Ltda cadastrado'),
    );
    expect(texto()).toContain('11.444.777/0001-61');
  });
});

describe('compras', () => {
  it('registra compra parcelada e cancela pelo detalhe', async () => {
    app = await montarApp('/compras');
    await esperar(() => expect(texto()).toContain('Nenhuma compra registrada'));
    await clicar('Nova compra');
    await escolherNoSelect('Fornecedor', 'Distribuidora Navalha');
    await escolherNoSelect('Produto 1', 'Cera em pó');
    await preencher('Quantidade 1', '4');
    await preencher('Custo unitário 1', '1000');
    await preencher('Frete', '500');
    await esperar(() => expect(normalizado()).toContain('R$ 45,00'));
    await clicarContendo('Parcelado');
    await esperar(() => expect(texto()).toContain('Parcela 2/2'));
    await clicar('Registrar compra');
    await esperar(() => expect(texto()).toContain('Compra #1 registrada'));
    await esperar(() => expect(celulas()).toContain('0/2 pagas'));
    const cera = (await api.estoque.obter()).produtos.find((p) => p.id === 4);
    expect(cera).toMatchObject({ saldo: 4, ultimoCusto: 10 });
    const compra = await api.compras.obter(1);
    expect(compra.parcelas.map((p) => p.valor)).toEqual([22.5, 22.5]);

    linhaCom('Distribuidora Navalha').click();
    await esperar(() =>
      expect(texto()).toContain('Compra #1 · Distribuidora Navalha'),
    );
    await clicar('Cancelar compra');
    await clicar('Cancelar compra', { ultimo: true });
    await esperar(() => expect(celulas()).toContain('Cancelada'));
    expect((await api.compras.obter(1)).cancelada).toBe(true);
    expect((await api.estoque.obter()).produtos[0].saldo).toBe(0);
  });
});

describe('ficha técnica', () => {
  it('inclui um consumível na ficha do serviço', async () => {
    await api.produtos.salvar({ nome: 'Lâmina', tipo: 'consumivel' });
    app = await montarApp('/servicos');
    await esperar(() => expect(texto()).toContain('Pigmentação'));
    linhaCom('Corte').click();
    await esperar(() => expect(texto()).toContain('Ficha técnica'));
    await esperar(() => expect(texto()).toContain('Sem ficha técnica'));
    await clicar('Incluir consumível');
    await escolherNoSelect('Consumível', 'Lâmina');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('Serviço atualizado'));
    expect(await api.fichas.obter(1)).toEqual([
      expect.objectContaining({ nome: 'Lâmina', quantidade: 1, valido: true }),
    ]);
  });
});
