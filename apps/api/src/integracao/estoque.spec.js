import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso } from '@barbertime/dominio';
import {
  comoSuperusuario,
  criarServidor,
  navegador,
  novaBarbearia,
  unico,
} from './apoio.ts';

// Planejamento 0027 (parte 1): estoque e compras. Critérios de aceite 1, 2, 3, 7 e 8.

let servidor;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

const ativarEstoque = (barbeariaId) =>
  comoSuperusuario((c) =>
    c.query(
      `insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, 'estoque', 'ativo')
       on conflict (barbearia_id, modulo) do update set estado = 'ativo'`,
      [barbeariaId],
    ),
  );

/** Barbearia com o módulo estoque, um serviço, um barbeiro e o caixa aberto. */
async function comEstoque() {
  const b = await novaBarbearia(servidor);
  await ativarEstoque(b.sessao.barbearia.id);
  const corte = (
    await b.dono.post('/api/servicos', {
      nome: 'Corte',
      duracao: 30,
      preco: 45,
    })
  ).corpo;
  const joao = (
    await b.dono.post('/api/barbeiros', {
      nome: 'João',
      inicio: '00:00',
      fim: '23:59',
      comissao: 40,
    })
  ).corpo;
  const produto = async (dados) =>
    (await b.dono.post('/api/produtos', dados)).corpo;
  const pomada = await produto({
    nome: 'Pomada',
    preco: 30,
    tipo: 'revenda',
    estoqueMinimo: 2,
  });
  const gel = await produto({
    nome: 'Gel',
    tipo: 'consumivel',
    unidade: 'ml',
  });
  const lamina = await produto({ nome: 'Lâmina', tipo: 'consumivel' });
  const fornecedor = (
    await b.dono.post('/api/fornecedores', {
      nome: 'Distribuidora',
      documento: '11.222.333/0001-81',
    })
  ).corpo;
  return { ...b, corte, joao, pomada, gel, lamina, fornecedor };
}

const saldoDe = async (dono, id) =>
  (await dono.get('/api/estoque')).corpo.produtos.find((p) => p.id === id)
    .saldo;

const hoje = () => momentoNoFuso().data;

async function convidar(dono, chave) {
  const papel = (await dono.get('/api/papeis')).corpo.find(
    (p) => p.chave === chave,
  );
  const email = `${unico(chave)}@teste.dev`;
  await dono.post('/api/usuarios', {
    nome: chave,
    email,
    senha: 'senha-segura',
    papelId: papel.id,
  });
  const n = navegador(servidor);
  await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
  return n;
}

describe('estoque na comanda paga (critério 1)', () => {
  it('baixa a revenda e a ficha técnica; saldo zero vende e entra em "Comprar"', async () => {
    const { dono, corte, joao, pomada, gel, lamina } = await comEstoque();
    const ficha = await dono.put(`/api/servicos/${corte.id}/ficha`, {
      itens: [
        { produtoId: gel.id, quantidade: '10' },
        { produtoId: lamina.id, quantidade: '1' },
      ],
    });
    expect(ficha.status).toBe(200);
    expect(ficha.corpo).toHaveLength(2);
    // Revenda não entra na ficha.
    expect(
      (
        await dono.put(`/api/servicos/${corte.id}/ficha`, {
          itens: [{ produtoId: pomada.id, quantidade: '1' }],
        })
      ).status,
    ).toBe(400);

    await dono.post('/api/caixa/abrir', { valorInicial: 50 });
    const cm = (
      await dono.post('/api/comandas', {
        barbeiroId: joao.id,
        itens: [
          { tipo: 'servico', refId: corte.id, quantidade: '2' },
          { tipo: 'produto', refId: pomada.id },
        ],
      })
    ).corpo;
    expect(
      (await dono.post(`/api/comandas/${cm.id}/receber`, { forma: 'pix' }))
        .status,
    ).toBe(200);

    expect(await saldoDe(dono, pomada.id)).toBe(-1);
    expect(await saldoDe(dono, gel.id)).toBe(-20);
    expect(await saldoDe(dono, lamina.id)).toBe(-2);
    const { comprar } = (await dono.get('/api/estoque')).corpo;
    expect(comprar.find((x) => x.produtoId === pomada.id)).toMatchObject({
      negativo: true,
      sugerido: 5,
    });
    const movs = (await dono.get(`/api/estoque/movimentos?produtoId=${gel.id}`))
      .corpo;
    expect(movs).toEqual([
      expect.objectContaining({
        tipo: 'consumo_servico',
        quantidade: -20,
        comandaId: cm.id,
        usuarioNome: 'Dono Teste',
      }),
    ]);
  });

  it('sem o módulo a comanda paga não mexe no estoque', async () => {
    const b = await novaBarbearia(servidor);
    const pomada = (
      await b.dono.post('/api/produtos', { nome: 'Pomada', preco: 30 })
    ).corpo;
    const joao = (
      await b.dono.post('/api/barbeiros', {
        nome: 'João',
        inicio: '00:00',
        fim: '23:59',
        comissao: 40,
      })
    ).corpo;
    await b.dono.post('/api/caixa/abrir', { valorInicial: 0 });
    const cm = (
      await b.dono.post('/api/comandas', {
        barbeiroId: joao.id,
        itens: [{ tipo: 'produto', refId: pomada.id }],
      })
    ).corpo;
    await b.dono.post(`/api/comandas/${cm.id}/receber`, { forma: 'pix' });
    // Sem o módulo, /produtos nem mostra o saldo: confere direto no banco.
    const saldo = await comoSuperusuario(
      async (c) =>
        (await c.query('select saldo from produtos where id = $1', [pomada.id]))
          .rows[0].saldo,
    );
    expect(saldo).toBe(0);
  });
});

describe('compras (critérios 2 e 3)', () => {
  const compra = (fornecedor, pomada, gel, lamina) => ({
    fornecedorId: fornecedor.id,
    data: hoje(),
    frete: '10',
    desconto: '0',
    itens: [
      { produtoId: pomada.id, quantidade: '5', custoUnitario: '12.5' },
      { produtoId: gel.id, quantidade: '500', custoUnitario: '0.1' },
      { produtoId: lamina.id, quantidade: '20', custoUnitario: '1.25' },
    ],
    // 62,5 + 50 + 25 + 10 = 147,50
    parcelas: [
      { valor: '73.75', vencimento: '2027-01-10' },
      { valor: '73.75', vencimento: '2027-02-09' },
    ],
  });

  it('3 itens em 2 parcelas: entrada, último custo e 2 contas que somam o total', async () => {
    const { dono, fornecedor, pomada, gel, lamina } = await comEstoque();
    const r = await dono.post(
      '/api/compras',
      compra(fornecedor, pomada, gel, lamina),
    );
    expect(r.status).toBe(201);
    expect(r.corpo.total).toBe(147.5);
    expect(r.corpo.itens).toHaveLength(3);
    expect(r.corpo.parcelas.map((p) => [p.parcela, p.valor])).toEqual([
      [1, 73.75],
      [2, 73.75],
    ]);
    expect(await saldoDe(dono, gel.id)).toBe(500);
    const produtos = (await dono.get('/api/estoque')).corpo.produtos;
    expect(produtos.find((p) => p.id === pomada.id)).toMatchObject({
      saldo: 5,
      ultimoCusto: 12.5,
    });
    const lista = (await dono.get('/api/compras')).corpo;
    expect(lista[0]).toMatchObject({
      fornecedorNome: 'Distribuidora',
      total: 147.5,
      parcelas: 2,
      quitadas: 0,
      cancelada: false,
    });
    // Parcelas que não somam o total: recusada, sem mexer no estoque.
    const errada = compra(fornecedor, pomada, gel, lamina);
    errada.parcelas[1].valor = '10';
    expect((await dono.post('/api/compras', errada)).status).toBe(400);
    expect(await saldoDe(dono, gel.id)).toBe(500);
  });

  it('cancelar sem parcela paga estorna; com parcela paga é recusado', async () => {
    const { dono, fornecedor, pomada, gel, lamina } = await comEstoque();
    const a = (
      await dono.post('/api/compras', compra(fornecedor, pomada, gel, lamina))
    ).corpo;
    const cancelada = await dono.post(`/api/compras/${a.id}/cancelar`);
    expect(cancelada.status).toBe(200);
    expect(cancelada.corpo.cancelada).toBe(true);
    expect(
      cancelada.corpo.parcelas.every((p) => p.situacao === 'cancelada'),
    ).toBe(true);
    expect(await saldoDe(dono, pomada.id)).toBe(0);
    expect(
      (
        await dono.get(`/api/estoque/movimentos?produtoId=${pomada.id}`)
      ).corpo.map((m) => m.tipo),
    ).toEqual(['estorno_compra', 'compra']);
    expect((await dono.post(`/api/compras/${a.id}/cancelar`)).status).toBe(409);

    const b = (
      await dono.post('/api/compras', compra(fornecedor, pomada, gel, lamina))
    ).corpo;
    await comoSuperusuario((c) =>
      c.query(
        "update contas set situacao = 'quitada', pago_em = current_date where id = $1",
        [b.parcelas[0].id],
      ),
    );
    const recusada = await dono.post(`/api/compras/${b.id}/cancelar`);
    expect(recusada.status).toBe(409);
    expect(recusada.corpo.mensagem).toContain('parcela paga');
    expect(await saldoDe(dono, pomada.id)).toBe(5);
  });

  it('cancelar estorna mesmo se o produto saiu do cadastro depois', async () => {
    const { dono, fornecedor, pomada, gel, lamina } = await comEstoque();
    const a = (
      await dono.post('/api/compras', compra(fornecedor, pomada, gel, lamina))
    ).corpo;
    expect((await dono.delete(`/api/produtos/${gel.id}`)).status).toBe(204);
    const r = await dono.post(`/api/compras/${a.id}/cancelar`);
    expect(r.status).toBe(200);
    expect(r.corpo.cancelada).toBe(true);
  });

  it('fornecedor com CNPJ inválido é recusado', async () => {
    const { dono } = await comEstoque();
    const r = await dono.post('/api/fornecedores', {
      nome: 'X',
      documento: '11.222.333/0001-80',
    });
    expect(r.status).toBe(400);
    expect(r.corpo.mensagem).toBe('CPF ou CNPJ inválido.');
  });
});

describe('inventário e consumo (critério 7)', () => {
  it('ajusta o saldo para o contado com um movimento da diferença', async () => {
    const { dono, gel, lamina } = await comEstoque();
    expect(
      (
        await dono.post('/api/estoque/consumo', {
          produtoId: gel.id,
          quantidade: '15.5',
          motivo: 'Derramou',
        })
      ).corpo.saldo,
    ).toBe(-15.5);
    expect(
      (
        await dono.post('/api/estoque/consumo', {
          produtoId: gel.id,
          quantidade: '1',
        })
      ).status,
    ).toBe(400);
    const r = await dono.post('/api/estoque/inventario', {
      itens: [
        { produtoId: gel.id, contado: '200' },
        { produtoId: lamina.id, contado: '0' },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.corpo.ajustes).toEqual([
      expect.objectContaining({ produtoId: gel.id, diferenca: 215.5 }),
    ]);
    expect(await saldoDe(dono, gel.id)).toBe(200);
    const movs = (await dono.get(`/api/estoque/movimentos?produtoId=${gel.id}`))
      .corpo;
    expect(movs.map((m) => [m.tipo, m.quantidade])).toEqual([
      ['ajuste_inventario', 215.5],
      ['consumo_manual', -15.5],
    ]);
    // A soma dos movimentos confere com o saldo materializado.
    const soma = await comoSuperusuario(async (c) =>
      Number(
        (
          await c.query(
            'select coalesce(sum(quantidade), 0) as s from movimentos_estoque where produto_id = $1',
            [gel.id],
          )
        ).rows[0].s,
      ),
    );
    expect(soma).toBe(200);
  });
});

describe('módulo e papéis (critério 8)', () => {
  it('sem o módulo, 403', async () => {
    const { dono } = await novaBarbearia(servidor);
    expect((await dono.get('/api/estoque')).status).toBe(403);
    expect((await dono.get('/api/fornecedores')).status).toBe(403);
    expect((await dono.get('/api/compras')).status).toBe(403);
  });

  it('recepção vê mas não movimenta; barbeiro não vê', async () => {
    const { dono, gel } = await comEstoque();
    const recepcao = await convidar(dono, 'recepcao');
    expect((await recepcao.get('/api/estoque')).status).toBe(200);
    expect((await recepcao.get('/api/compras')).status).toBe(200);
    expect(
      (
        await recepcao.post('/api/estoque/consumo', {
          produtoId: gel.id,
          quantidade: '1',
          motivo: 'x',
        })
      ).status,
    ).toBe(403);
    expect(
      (await recepcao.post('/api/fornecedores', { nome: 'Y' })).status,
    ).toBe(403);
    const barbeiro = await convidar(dono, 'barbeiro');
    expect((await barbeiro.get('/api/estoque')).status).toBe(403);
    expect((await barbeiro.get('/api/compras')).status).toBe(403);
  });
});

describe('ajustes da revisão (planejamento 0027)', () => {
  it('custo e saldo só aparecem em /produtos para quem vê o estoque', async () => {
    const { dono } = await comEstoque();
    const barbeiro = await convidar(dono, 'barbeiro');
    const lista = (await barbeiro.get('/api/produtos')).corpo;
    expect(lista.length).toBeGreaterThan(0);
    expect(lista[0]).not.toHaveProperty('ultimoCusto');
    expect(lista[0]).not.toHaveProperty('saldo');
    expect((await dono.get('/api/produtos')).corpo[0]).toHaveProperty('saldo');
  });

  it('salvar produto sem estoque.ver também não devolve custo nem saldo', async () => {
    // Sem o módulo estoque, o Dono gerencia o catálogo mas não vê o estoque.
    const { dono } = await novaBarbearia(servidor);
    const criado = await dono.post('/api/produtos', {
      nome: 'Cera',
      preco: 25,
    });
    expect(criado.status).toBe(200);
    expect(criado.corpo).not.toHaveProperty('ultimoCusto');
    expect(criado.corpo).not.toHaveProperty('saldo');
    const editado = await dono.put(`/api/produtos/${criado.corpo.id}`, {
      nome: 'Cera',
      preco: 28,
    });
    expect(editado.status).toBe(200);
    expect(editado.corpo).not.toHaveProperty('ultimoCusto');
    expect(editado.corpo).not.toHaveProperty('saldo');
  });

  it('compra lançada com data antiga não sobrescreve o último custo', async () => {
    const { dono, fornecedor, pomada } = await comEstoque();
    const comprar = (custo, data) =>
      dono.post('/api/compras', {
        fornecedorId: fornecedor.id,
        data,
        itens: [
          { produtoId: pomada.id, quantidade: '1', custoUnitario: custo },
        ],
        parcelas: [{ valor: custo, vencimento: hoje() }],
      });
    expect((await comprar('10', hoje())).status).toBe(201);
    const antiga = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect((await comprar('8', antiga)).status).toBe(201);
    const custo = (await dono.get('/api/estoque')).corpo.produtos.find(
      (p) => p.id === pomada.id,
    ).ultimoCusto;
    expect(custo).toBe(10);
  });

  it('compra sem fornecedor dá 400, não 500', async () => {
    const { dono, pomada } = await comEstoque();
    const r = await dono.post('/api/compras', {
      data: hoje(),
      itens: [{ produtoId: pomada.id, quantidade: '1', custoUnitario: '10' }],
      parcelas: [{ valor: '10', vencimento: hoje() }],
    });
    expect(r.status).toBe(400);
  });

  it('cancelar a compra devolve o último custo ao da compra anterior', async () => {
    const { dono, fornecedor, pomada } = await comEstoque();
    const comprar = (custo) =>
      dono.post('/api/compras', {
        fornecedorId: fornecedor.id,
        data: hoje(),
        itens: [
          { produtoId: pomada.id, quantidade: '1', custoUnitario: custo },
        ],
        parcelas: [{ valor: custo, vencimento: hoje() }],
      });
    await comprar('12');
    const errada = (await comprar('999')).corpo;
    const custo = async () =>
      (await dono.get('/api/estoque')).corpo.produtos.find(
        (p) => p.id === pomada.id,
      ).ultimoCusto;
    expect(await custo()).toBe(999);
    await dono.post(`/api/compras/${errada.id}/cancelar`);
    expect(await custo()).toBe(12);
  });

  it('produto em comanda aberta não vira consumível', async () => {
    const { dono, joao, pomada } = await comEstoque();
    await dono.post('/api/caixa/abrir', { valorInicial: 0 });
    await dono.post('/api/comandas', {
      barbeiroId: joao.id,
      itens: [{ tipo: 'produto', refId: pomada.id }],
    });
    const r = await dono.put(`/api/produtos/${pomada.id}`, {
      nome: 'Pomada',
      tipo: 'consumivel',
    });
    expect(r.status).toBe(409);
  });
});
