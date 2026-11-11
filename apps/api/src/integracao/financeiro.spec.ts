import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso, somarDias } from '@barbertime/dominio';
import {
  comoSuperusuario,
  criarServidor,
  navegador,
  novaBarbearia,
  unico,
} from './apoio.ts';
import type { ServidorDeTeste } from './apoio.ts';

type Navegador = Awaited<ReturnType<typeof novaBarbearia>>['dono'];

// Planejamento 0027, parte 2, fatia 2A: contas a pagar e a receber,
// categorias e a baixa com dinheiro do caixa.

let servidor: ServidorDeTeste;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

const hoje = () => momentoNoFuso().data;

const ligarModulo = (barbeariaId: number, estado = 'ativo') =>
  comoSuperusuario((c) =>
    c.query(
      `insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, 'financeiro', $2)
       on conflict (barbearia_id, modulo) do update set estado = $2`,
      [barbeariaId, estado],
    ),
  );

async function entrarComo(dono: Navegador, chave: string) {
  const papel = (await dono.get('/api/papeis')).corpo.find(
    (p: { chave: string }) => p.chave === chave,
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

async function comFinanceiro({ modulo = true, caixa = true } = {}) {
  const b = await novaBarbearia(servidor);
  const id = b.sessao.barbearia.id;
  if (modulo) await ligarModulo(id);
  const { dono } = b;
  if (caixa) await dono.post('/api/caixa/abrir', { valorInicial: 100 });
  const categorias = modulo
    ? (await dono.get('/api/financeiro/categorias')).corpo
    : [];
  const categoria = (nome: string) =>
    categorias.find((x: { nome: string }) => x.nome === nome);
  const novaConta = (dados = {}) =>
    dono.post('/api/financeiro/contas', {
      tipo: 'pagar',
      descricao: 'Aluguel de novembro',
      categoriaId: categoria('Aluguel')?.id,
      valor: 1500,
      vencimento: somarDias(hoje(), 5),
      ...dados,
    });
  const baixar = (conta: { id: number; valor: number }, dados = {}) =>
    dono.post(`/api/financeiro/contas/${conta.id}/baixar`, {
      data: hoje(),
      valorPago: conta.valor,
      forma: 'pix',
      ...dados,
    });
  const resumo = async () => (await dono.get('/api/caixa')).corpo.resumo;
  return { ...b, id, categoria, novaConta, baixar, resumo };
}

describe('categorias', () => {
  it('nascem as padrão; nome repetido é recusado; com conta só desativa', async () => {
    const b = await comFinanceiro();
    expect(b.categoria('Aluguel')).toMatchObject({
      tipo: 'pagar',
      ativa: true,
    });
    expect(b.categoria('Aluguel de cadeira')).toMatchObject({
      tipo: 'receber',
    });

    const nova = await b.dono.post('/api/financeiro/categorias', {
      nome: 'Marketing',
      tipo: 'pagar',
    });
    expect(nova.status).toBe(201);
    expect(
      (
        await b.dono.post('/api/financeiro/categorias', {
          nome: 'marketing',
          tipo: 'pagar',
        })
      ).status,
    ).toBe(409);

    await b.novaConta({ categoriaId: nova.corpo.id });
    const ex = await b.dono.delete(
      `/api/financeiro/categorias/${nova.corpo.id}`,
    );
    expect(ex.status).toBe(409);
    expect(ex.corpo.mensagem).toMatch(/desative/);
    const off = await b.dono.put(
      `/api/financeiro/categorias/${nova.corpo.id}`,
      {
        nome: 'Marketing',
        ativa: false,
      },
    );
    expect(off.corpo.ativa).toBe(false);
    // Desativada não recebe conta nova.
    expect((await b.novaConta({ categoriaId: nova.corpo.id })).status).toBe(
      400,
    );
  });
});

describe('contas', () => {
  it('lança, edita, cancela e filtra; valida tipo da categoria', async () => {
    const b = await comFinanceiro();
    const r = await b.novaConta();
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({
      tipo: 'pagar',
      categoriaNome: 'Aluguel',
      valor: 1500,
      situacao: 'aberta',
      situacaoAtual: 'aberta',
      origem: 'manual',
    });
    expect((await b.novaConta({ valor: 0 })).status).toBe(400);
    const tipoErrado = await b.novaConta({
      categoriaId: b.categoria('Outras receitas').id,
    });
    expect(tipoErrado.status).toBe(400);
    expect(tipoErrado.corpo.mensagem).toMatch(/a receber/);

    const editada = await b.dono.put(`/api/financeiro/contas/${r.corpo.id}`, {
      descricao: 'Aluguel',
      categoriaId: b.categoria('Aluguel').id,
      valor: 1600,
      vencimento: somarDias(hoje(), 10),
    });
    expect(editada.corpo).toMatchObject({ valor: 1600, descricao: 'Aluguel' });

    const vencida = (
      await b.novaConta({ descricao: 'Luz', vencimento: somarDias(hoje(), -2) })
    ).corpo;
    expect(vencida.situacaoAtual).toBe('vencida');
    const lista = (
      await b.dono.get('/api/financeiro/contas?tipo=pagar&situacao=vencida')
    ).corpo;
    expect(lista.map((c: { descricao: string }) => c.descricao)).toEqual([
      'Luz',
    ]);

    const cancelada = await b.dono.post(
      `/api/financeiro/contas/${vencida.id}/cancelar`,
    );
    expect(cancelada.corpo.situacao).toBe('cancelada');
    // Cancelada sai da lista padrão.
    expect(
      (await b.dono.get('/api/financeiro/contas')).corpo.map(
        (c: { id: number }) => c.id,
      ),
    ).toEqual([r.corpo.id]);
    // "Todas" inclui as canceladas.
    expect(
      (await b.dono.get('/api/financeiro/contas?situacao=todas')).corpo.length,
    ).toBe(2);
  });

  it('parcela de compra: só o vencimento muda e não se cancela sozinha', async () => {
    const b = await comFinanceiro();
    const {
      rows: [parcela],
    } = await comoSuperusuario((c) =>
      c.query(
        `insert into contas (barbearia_id, tipo, descricao, categoria_id, valor, vencimento, origem)
         values ($1, 'pagar', 'Compra #1 (1/2)', $2, 200, $3, 'compra') returning id`,
        [b.id, b.categoria('Compra de produtos').id, hoje()],
      ),
    );
    const nova = somarDias(hoje(), 3);
    const r = await b.dono.put(`/api/financeiro/contas/${parcela.id}`, {
      descricao: 'Outra coisa',
      valor: 1,
      vencimento: nova,
    });
    expect(r.corpo).toMatchObject({
      vencimento: nova,
      valor: 200,
      descricao: 'Compra #1 (1/2)',
    });
    const c = await b.dono.post(
      `/api/financeiro/contas/${parcela.id}/cancelar`,
    );
    expect(c.status).toBe(409);
    expect(c.corpo.mensagem).toMatch(/cancele a compra/);
  });
});

describe('baixa e caixa', () => {
  it('Pix quita sem mexer no caixa e estorna a qualquer momento', async () => {
    const b = await comFinanceiro();
    const conta = (await b.novaConta({ valor: 80 })).corpo;
    const r = await b.baixar(conta, { valorPago: 82.5 });
    expect(r.corpo).toMatchObject({
      situacao: 'quitada',
      valorPago: 82.5,
      forma: 'pix',
      pagoEm: hoje(),
    });
    expect((await b.resumo()).dinheiroEsperado).toBe(100);
    expect((await b.baixar(conta)).status).toBe(409);
    const e = await b.dono.post(`/api/financeiro/contas/${conta.id}/estornar`);
    expect(e.corpo).toMatchObject({ situacao: 'aberta', valorPago: null });
  });

  it('dinheiro do caixa: saída reduz a gaveta; estorno devolve; caixa fechado não estorna', async () => {
    const b = await comFinanceiro();
    const conta = (await b.novaConta({ valor: 30 })).corpo;
    const ontem = await b.baixar(conta, {
      forma: 'dinheiro_caixa',
      data: somarDias(hoje(), -1),
    });
    expect(ontem.status).toBe(400);
    expect((await b.baixar(conta, { forma: 'dinheiro_caixa' })).status).toBe(
      200,
    );
    expect(await b.resumo()).toMatchObject({
      saidas: 30,
      entradas: 0,
      dinheiroEsperado: 70,
    });

    await b.dono.post(`/api/financeiro/contas/${conta.id}/estornar`);
    expect((await b.resumo()).dinheiroEsperado).toBe(100);

    // Paga de novo e fecha o caixa: o estorno é recusado.
    await b.baixar(conta, { forma: 'dinheiro_caixa' });
    expect(
      (await b.dono.post('/api/caixa/fechar', { dinheiroContado: 70 })).status,
    ).toBe(200);
    const e = await b.dono.post(`/api/financeiro/contas/${conta.id}/estornar`);
    expect(e.status).toBe(409);
    expect(e.corpo.mensagem).toMatch(/já foi fechado/);
  });

  it('receber com dinheiro do caixa é entrada; sem caixa aberto é recusado', async () => {
    const b = await comFinanceiro();
    const conta = (
      await b.novaConta({
        tipo: 'receber',
        descricao: 'Aluguel da cadeira',
        categoriaId: b.categoria('Aluguel de cadeira').id,
        valor: 250,
      })
    ).corpo;
    await b.baixar(conta, { forma: 'dinheiro_caixa' });
    expect(await b.resumo()).toMatchObject({
      entradas: 250,
      dinheiroEsperado: 350,
    });

    const semCaixa = await comFinanceiro({ caixa: false });
    const c2 = (await semCaixa.novaConta()).corpo;
    const r = await semCaixa.baixar(c2, { forma: 'dinheiro_caixa' });
    expect(r.status).toBe(409);
    expect(r.corpo.mensagem).toMatch(/Abra o caixa/);
  });
});

describe('regressões da revisão', () => {
  it('#25: categoria padrão excluída ou renomeada não volta', async () => {
    const b = await comFinanceiro();
    const internet = b.categoria('Internet');
    expect(
      (await b.dono.delete(`/api/financeiro/categorias/${internet.id}`)).status,
    ).toBe(204);
    await b.dono.put(`/api/financeiro/categorias/${b.categoria('Água').id}`, {
      nome: 'Água e esgoto',
    });
    const nomes = (await b.dono.get('/api/financeiro/categorias')).corpo.map(
      (x: { nome: string }) => x.nome,
    );
    expect(nomes).not.toContain('Internet');
    expect(nomes).not.toContain('Água');
    expect(nomes).toContain('Água e esgoto');
  });

  it('#27: conta de fornecedor excluído depois continua editável', async () => {
    const b = await comFinanceiro();
    const {
      rows: [f],
    } = await comoSuperusuario((c) =>
      c.query(
        "insert into fornecedores (barbearia_id, nome) values ($1, 'Imobiliária') returning id",
        [b.id],
      ),
    );
    const conta = (await b.novaConta({ fornecedorId: f.id })).corpo;
    await comoSuperusuario((c) =>
      c.query('update fornecedores set excluido_em = now() where id = $1', [
        f.id,
      ]),
    );
    const r = await b.dono.put(`/api/financeiro/contas/${conta.id}`, {
      ...conta,
      vencimento: somarDias(hoje(), 20),
    });
    expect(r.status).toBe(200);
    expect(r.corpo.fornecedorId).toBe(f.id);
  });

  it('#28: baixa em dinheiro e fechamento ao mesmo tempo ficam coerentes', async () => {
    const b = await comFinanceiro();
    const conta = (await b.novaConta({ valor: 30 })).corpo;
    const [baixa, fechado] = await Promise.all([
      b.baixar(conta, { forma: 'dinheiro_caixa' }),
      b.dono.post('/api/caixa/fechar', { dinheiroContado: 100 }),
    ]);
    expect(fechado.status).toBe(200);
    // Ou a baixa entrou antes (o fechamento já conta a saída), ou foi recusada.
    if (baixa.status === 200) expect(fechado.corpo.diferenca).toBe(30);
    else {
      expect(baixa.status).toBe(409);
      expect(fechado.corpo.diferenca).toBe(0);
    }
  });

  it('#29: valor fora do limite é 400, não 500', async () => {
    const b = await comFinanceiro();
    for (const valor of ['99999999999', 'Infinity', '1e400'])
      expect((await b.novaConta({ valor })).status).toBe(400);
    const conta = (await b.novaConta()).corpo;
    expect((await b.baixar(conta, { valorPago: '1e400' })).status).toBe(400);
  });
});

describe('acesso', () => {
  it('Recepção e Barbeiro não acessam; sem o módulo, 403; outra barbearia não vê', async () => {
    const b = await comFinanceiro();
    const conta = (await b.novaConta()).corpo;
    for (const papel of ['recepcao', 'barbeiro']) {
      const n = await entrarComo(b.dono, papel);
      expect((await n.get('/api/financeiro/contas')).status).toBe(403);
      expect(
        (
          await n.post(`/api/financeiro/contas/${conta.id}/baixar`, {
            data: hoje(),
            valorPago: 1,
            forma: 'pix',
          })
        ).status,
      ).toBe(403);
    }
    const gerente = await entrarComo(b.dono, 'gerente');
    expect((await gerente.get('/api/financeiro/contas')).status).toBe(200);

    const outra = await comFinanceiro();
    expect(
      (await outra.dono.get(`/api/financeiro/contas/${conta.id}`)).status,
    ).toBe(404);
    expect((await outra.baixar(conta, { forma: 'pix' })).status).toBe(404);

    await ligarModulo(b.id, 'inativo');
    expect((await b.dono.get('/api/financeiro/contas')).status).toBe(403);
  });
});

// Critério 5: recorrências (planejamento 0027, fatia 2B)
describe('recorrências', () => {
  it('cria recorrência, gera 3 contas e encerrar cancela as futuras', async () => {
    const b = await comFinanceiro({ caixa: false });
    const catId = b.categoria('Aluguel')?.id;

    // Criar recorrência a pagar.
    const r1 = await b.dono.post('/api/financeiro/recorrencias', {
      tipo: 'pagar',
      descricao: 'Aluguel mensal',
      categoriaId: catId,
      valor: 2000,
      diaDoMes: 10,
    });
    expect(r1.status).toBe(201);
    expect(r1.corpo).toMatchObject({
      tipo: 'pagar',
      descricao: 'Aluguel mensal',
      diaDoMes: 10,
      encerradaEm: null,
    });

    // GET deve ter gerado 3 contas.
    const lista = (await b.dono.get('/api/financeiro/recorrencias')).corpo;
    expect(lista).toHaveLength(1);
    const contas = (
      await b.dono.get('/api/financeiro/contas?situacao=todas')
    ).corpo;
    // Contas geradas da recorrência são 3 (pode ter outras da semente).
    const daRecorrencia = contas.filter(
      (ct: { recorrenciaId: number | null }) =>
        ct.recorrenciaId === r1.corpo.id,
    );
    expect(daRecorrencia).toHaveLength(3);
    expect(
      daRecorrencia.every(
        (ct: { situacao: string }) => ct.situacao === 'aberta',
      ),
    ).toBe(true);

    // Idempotente: listar de novo não duplica.
    await b.dono.get('/api/financeiro/recorrencias');
    const contas2 = (
      await b.dono.get('/api/financeiro/contas?situacao=todas')
    ).corpo;
    expect(
      contas2.filter(
        (ct: { recorrenciaId: number | null }) =>
          ct.recorrenciaId === r1.corpo.id,
      ),
    ).toHaveLength(3);

    // Encerrar cancela as futuras em aberto.
    const enc = await b.dono.post(
      `/api/financeiro/recorrencias/${r1.corpo.id}/encerrar`,
    );
    expect(enc.status).toBe(200);
    expect(enc.corpo.encerradaEm).toBeTruthy();

    const contas3 = (
      await b.dono.get('/api/financeiro/contas?situacao=todas')
    ).corpo;
    const abertas = contas3.filter(
      (ct: { recorrenciaId: number | null; situacao: string }) =>
        ct.recorrenciaId === r1.corpo.id && ct.situacao === 'aberta',
    );
    expect(abertas).toHaveLength(0);

    // Já encerrada: recusa novo encerramento.
    expect(
      (
        await b.dono.post(
          `/api/financeiro/recorrencias/${r1.corpo.id}/encerrar`,
        )
      ).status,
    ).toBe(409);
  });

  it('valida tipo, dia e categoria', async () => {
    const b = await comFinanceiro({ caixa: false });
    const catId = b.categoria('Aluguel')?.id;
    const base = {
      tipo: 'pagar',
      descricao: 'Teste',
      categoriaId: catId,
      valor: 100,
      diaDoMes: 10,
    };
    expect(
      (await b.dono.post('/api/financeiro/recorrencias', { ...base, diaDoMes: 29 })).status,
    ).toBe(400);
    expect(
      (await b.dono.post('/api/financeiro/recorrencias', { ...base, diaDoMes: 0 })).status,
    ).toBe(400);
    expect(
      (await b.dono.post('/api/financeiro/recorrencias', { ...base, tipo: 'outro' })).status,
    ).toBe(400);
  });
});

// Critério 6: previsão de fluxo de caixa (planejamento 0027, fatia 2B)
describe('previsão', () => {
  it('agrega contas abertas por semana; vencidas ficam separadas', async () => {
    const b = await comFinanceiro({ caixa: false });
    const catId = b.categoria('Aluguel')?.id;

    // Lança conta vencida.
    await b.dono.post('/api/financeiro/contas', {
      tipo: 'pagar',
      descricao: 'Vencida',
      categoriaId: catId,
      valor: 500,
      vencimento: somarDias(hoje(), -5),
    });
    // Lança conta futura no período.
    await b.dono.post('/api/financeiro/contas', {
      tipo: 'pagar',
      descricao: 'Futura',
      categoriaId: catId,
      valor: 1000,
      vencimento: somarDias(hoje(), 10),
    });
    // Lança conta a receber futura.
    await b.dono.post('/api/financeiro/contas', {
      tipo: 'receber',
      descricao: 'Receita',
      categoriaId: b.categoria('Aluguel de cadeira')?.id,
      valor: 800,
      vencimento: somarDias(hoje(), 10),
    });

    const r = await b.dono.get('/api/financeiro/previsao?dias=30');
    expect(r.status).toBe(200);
    expect(r.corpo.vencidaPagar).toBe(500);
    expect(r.corpo.semanas.length).toBeGreaterThan(0);
    // Semana com as contas futuras
    const semana = r.corpo.semanas.find(
      (s: { pagar: number }) => s.pagar === 1000,
    );
    expect(semana).toBeDefined();
    expect(semana.receber).toBe(800);
    expect(semana.saldo).toBe(-200);
    expect(r.corpo.totalPagar).toBe(1500);
    expect(r.corpo.totalReceber).toBe(800);
    expect(r.corpo.saldoPrevisto).toBe(-700);
  });
});
