import { describe, it, expect, beforeEach } from 'vitest';
import { criarApi } from './api.ts';
import { ErroDeNegocio } from './erros.ts';
import { somarDias } from '@barbertime/dominio';
import type { Api, Corpo } from './tipos.ts';

// Sábado, 7/11/2026, 08:00: antes de qualquer expediente.
const agora = () => new Date(2026, 10, 7, 8, 0);
const HOJE = '2026-11-07';
const AMANHA = '2026-11-08';
let api: Api;

beforeEach(() => {
  api = criarApi({ agora });
});

const recusa = (promessa: Promise<unknown>, trecho: string) =>
  expect(promessa).rejects.toSatisfy(
    (e: unknown) => e instanceof ErroDeNegocio && e.message.includes(trecho),
  );

describe('agendamentos', () => {
  it('lista o dia ordenado, com nomes, sem cancelados', async () => {
    const dia = await api.agendamentos.listarDoDia(HOJE);
    expect(dia.map((a) => a.inicio)).toEqual([
      '09:00',
      '10:00',
      '10:00',
      '11:00',
      '12:00',
      '14:00',
    ]);
    expect(dia[0]).toMatchObject({
      clienteNome: 'Rafael Souza',
      barbeiroNome: 'Zé Carlos',
    });
    expect(dia.find((a) => a.estado === 'bloqueado')?.clienteNome).toBe(
      'Almoço',
    );
  });

  it('horários livres respeitam ocupados e expediente', async () => {
    const livres = await api.agendamentos.horariosLivres({
      data: HOJE,
      barbeiroId: 1,
      servicoId: 1,
    });
    const disponivel = (h: string) =>
      livres.find((l) => l.hora === h)?.disponivel;
    expect(disponivel('09:00')).toBe(false);
    expect(disponivel('11:00')).toBe(true);
    expect(disponivel('12:30')).toBe(false);
    expect(livres.at(-1)?.hora).toBe('18:30');
  });

  it('cria e recusa o mesmo horário com a mensagem de negação', async () => {
    await api.agendamentos.criar({
      data: AMANHA,
      inicio: '11:00',
      barbeiroId: 1,
      servicoId: 1,
      clienteId: 3,
    });
    await recusa(
      api.agendamentos.criar({
        data: AMANHA,
        inicio: '11:15',
        barbeiroId: 1,
        servicoId: 1,
        clienteId: 4,
      }),
      'acabou de ser ocupado',
    );
  });

  it('recusa fora do expediente e dia passado', async () => {
    await recusa(
      api.agendamentos.criar({
        data: AMANHA,
        inicio: '18:45',
        barbeiroId: 1,
        servicoId: 1,
        clienteId: 1,
      }),
      'atende das 09:00 às 19:00',
    );
    await recusa(
      api.agendamentos.criar({
        data: '2026-11-01',
        inicio: '10:00',
        barbeiroId: 1,
        servicoId: 1,
        clienteId: 1,
      }),
      'já passou',
    );
  });

  it('página pública reaproveita o cliente pelo telefone ou cria um novo', async () => {
    const a = await api.agendamentos.criar({
      data: AMANHA,
      inicio: '14:00',
      barbeiroId: 2,
      servicoId: 1,
      cliente: { nome: 'Outro nome', telefone: '(11) 98765-4321' },
    });
    expect(a.clienteNome).toBe('Rafael Souza');
    const b = await api.agendamentos.criar({
      data: AMANHA,
      inicio: '15:00',
      barbeiroId: 2,
      servicoId: 1,
      cliente: { nome: 'Cliente Novo', telefone: '11911112222' },
    });
    expect(b.clienteNome).toBe('Cliente Novo');
  });

  it('transições de estado válidas e inválidas', async () => {
    expect((await api.agendamentos.alterarEstado(2, 'confirmado')).estado).toBe(
      'confirmado',
    );
    expect((await api.agendamentos.alterarEstado(2, 'faltou')).estado).toBe(
      'faltou',
    );
    await recusa(
      api.agendamentos.alterarEstado(2, 'confirmado'),
      'não pode mais',
    );
  });

  it('responde no formato da API: status do atendimento e confirmação', async () => {
    // Pendente é "agendado"; sem o balcão na memória, o confirmado conta como
    // "chegou" e pode ser marcado atendido na agenda.
    expect((await api.agendamentos.obter(2)).status).toBe('agendado');
    const confirmado = await api.agendamentos.alterarEstado(2, 'confirmado');
    expect(confirmado.status).toBe('chegou');
    expect(confirmado.confirmadoEm).toBe(HOJE);
    const atendido = await api.agendamentos.alterarEstado(2, 'atendido');
    expect(atendido.status).toBe('atendido');
    expect(atendido.confirmadoEm).toBe(HOJE);
  });

  it('cancelar libera o horário', async () => {
    await api.agendamentos.alterarEstado(2, 'cancelado');
    const livres = await api.agendamentos.horariosLivres({
      data: HOJE,
      barbeiroId: 1,
      servicoId: 1,
    });
    expect(livres.find((l) => l.hora === '10:00')?.disponivel).toBe(true);
  });

  it('bloqueio ocupa o horário', async () => {
    await api.agendamentos.bloquear({
      data: AMANHA,
      inicio: '16:00',
      fim: '17:00',
      barbeiroId: 3,
      motivo: 'Médico',
    });
    await recusa(
      api.agendamentos.criar({
        data: AMANHA,
        inicio: '16:30',
        barbeiroId: 3,
        servicoId: 1,
        clienteId: 1,
      }),
      'ocupado',
    );
  });
});

describe('clientes', () => {
  it('busca por nome ou telefone e traz o resumo', async () => {
    expect(
      (await api.clientes.listar({ busca: 'rafa' })).map((c) => c.nome),
    ).toEqual(['Rafael Souza']);
    expect((await api.clientes.listar({ busca: '3456-7890' }))[0].nome).toBe(
      'Gustavo Rocha',
    );
    const bruno = await api.clientes.obter(2);
    expect(bruno).toMatchObject({ faltas: 1, atendimentos: 0 });
  });

  it('reconhecer (público) devolve só o primeiro nome, ou null', async () => {
    expect(
      await api.publico.reconhecer(
        'barbearia-modelo',
        undefined,
        '(11) 98765-4321',
      ),
    ).toEqual({
      primeiroNome: 'Rafael',
    });
    expect(
      await api.publico.reconhecer(
        'barbearia-modelo',
        undefined,
        '11900000000',
      ),
    ).toBeNull();
  });

  it('recusa telefone repetido citando o dono', async () => {
    await recusa(
      api.clientes.salvar({ nome: 'X', telefone: '11987654321' }),
      'Rafael Souza',
    );
  });

  it('recusa excluir cliente com agendamento futuro', async () => {
    await recusa(api.clientes.excluir(1), 'agendamento futuro');
    await api.clientes.excluir(8);
    expect((await api.clientes.listar()).some((c) => c.id === 8)).toBe(false);
  });

  it('histórico do mais recente para o mais antigo', async () => {
    const h = await api.clientes.historico(1);
    expect(h.map((a) => a.data)).toEqual([HOJE, '2026-10-31', '2026-10-24']);
  });
});

describe('serviços e equipe', () => {
  it('recusa excluir serviço ou barbeiro em uso', async () => {
    await recusa(api.servicos.excluir(1), 'agendamentos futuros');
    await recusa(api.barbeiros.excluir(1), 'agendamentos futuros');
  });

  it('conta agendamentos futuros do serviço', async () => {
    expect(await api.servicos.contarFuturos(1)).toBe(3);
    expect(await api.servicos.contarFuturos(4)).toBe(1);
  });

  it('cria serviço e recusa nome repetido', async () => {
    const s = await api.servicos.salvar({
      nome: 'Sobrancelha',
      duracao: 15,
      preco: 20,
    });
    expect(s.id).toBe(5);
    await recusa(
      api.servicos.salvar({ nome: 'corte', duracao: 30, preco: 40 }),
      'Já existe',
    );
  });

  it('valida expediente e comissão do barbeiro', async () => {
    await recusa(
      api.barbeiros.salvar({
        nome: 'A',
        inicio: '18:00',
        fim: '09:00',
        comissao: 40,
      }),
      'depois do início',
    );
    await recusa(
      api.barbeiros.salvar({
        nome: 'A',
        inicio: '09:00',
        fim: '18:00',
        comissao: 140,
      }),
      'entre 0% e 100%',
    );
  });
});

describe('produtos', () => {
  it('lista em ordem alfabética', async () => {
    expect((await api.produtos.listar()).map((p) => p.nome)).toEqual([
      'Cera em pó',
      'Óleo para barba',
      'Pomada modeladora',
      'Shampoo anticaspa',
    ]);
  });

  it('cria, edita e exclui', async () => {
    const novo = await api.produtos.salvar({
      nome: 'Balm pós-barba',
      preco: 32,
      comissao: 10,
    });
    expect(novo.id).toBe(5);
    await api.produtos.salvar({ ...novo, preco: 35 });
    expect((await api.produtos.listar()).find((p) => p.id === 5)?.preco).toBe(
      35,
    );
    await api.produtos.excluir(5);
    expect((await api.produtos.listar()).some((p) => p.id === 5)).toBe(false);
  });

  it('recusa nome repetido, preço vazio e comissão fora do intervalo', async () => {
    await recusa(
      api.produtos.salvar({ nome: 'pomada MODELADORA', preco: 10 }),
      'Já existe',
    );
    await recusa(
      api.produtos.salvar({ nome: 'Novo', preco: null }),
      'preço de venda',
    );
    await recusa(
      api.produtos.salvar({ nome: 'Novo', preco: 10, comissao: 150 }),
      'entre 0% e 100%',
    );
  });
});

describe('caixa e comandas', () => {
  it('resumo do caixa de exemplo: só pagas, por forma, total bate', async () => {
    const caixa = await api.caixa.obterDoDia();
    expect(caixa?.resumo.porForma).toEqual({
      dinheiro: 70,
      pix: 60,
      debito: 0,
      credito: 0,
    });
    expect(caixa?.resumo).toMatchObject({
      totalRecebido: 130,
      dinheiroEsperado: 170,
      abertas: 1,
    });
  });

  it('não abre o caixa duas vezes', async () => {
    await recusa(api.caixa.abrir({ valorInicial: 50 }), 'já está aberto');
  });

  it('lista comandas com nomes e totais, mais recente primeiro', async () => {
    const lista = await api.comandas.listarDoDia();
    expect(lista.map((c) => c.id)).toEqual([3, 2, 1]);
    expect(lista[0]).toMatchObject({
      clienteNome: 'Cliente avulso',
      barbeiroNome: 'Léo',
      total: 39.9,
    });
  });

  it('cria comanda guardando nome e preço do momento da venda', async () => {
    const c = await api.comandas.salvar({
      barbeiroId: 1,
      clienteId: 2,
      itens: [
        { tipo: 'servico', refId: 1 },
        { tipo: 'produto', refId: 4, quantidade: 2 },
      ],
    });
    expect(c.itens).toEqual([
      {
        tipo: 'servico',
        refId: 1,
        nome: 'Corte',
        preco: 45,
        quantidade: 1,
        barbeiroId: 1,
      },
      {
        tipo: 'produto',
        refId: 4,
        nome: 'Cera em pó',
        preco: 44.9,
        quantidade: 2,
        barbeiroId: 1,
      },
    ]);
    expect(c.total).toBe(134.8);
    await api.servicos.salvar({ id: 1, nome: 'Corte', duracao: 30, preco: 50 });
    expect((await api.comandas.obter(c.id)).itens[0].preco).toBe(45);
  });

  it('recusas ao receber: sem itens, desconto alto, sem forma', async () => {
    const vazia = await api.comandas.salvar({ barbeiroId: 1, itens: [] });
    await recusa(
      api.comandas.receber(vazia.id, { forma: 'pix' }),
      'pelo menos um',
    );
    await recusa(
      api.comandas.salvar({
        barbeiroId: 1,
        itens: [{ tipo: 'produto', refId: 1 }],
        desconto: 100,
      }),
      'desconto',
    );
    await recusa(api.comandas.receber(3), 'forma de pagamento');
  });

  it('receber entra no resumo; paga não pode ser cancelada', async () => {
    await api.comandas.receber(3, { forma: 'debito' });
    const caixa = await api.caixa.obterDoDia();
    expect(caixa?.resumo.porForma.debito).toBe(39.9);
    expect(caixa?.resumo.abertas).toBe(0);
    await recusa(api.comandas.cancelar(3), 'não pode ser cancelada');
  });

  it('fechar: recusa com comanda aberta; depois calcula a diferença e bloqueia novas comandas', async () => {
    await recusa(
      api.caixa.fechar({ dinheiroContado: 170 }),
      '1 comanda em aberto',
    );
    await api.comandas.cancelar(3);
    const fechado = await api.caixa.fechar({ dinheiroContado: 165 });
    expect(fechado).toMatchObject({ aberto: false, diferenca: -5 });
    await recusa(
      api.comandas.salvar({ barbeiroId: 1, itens: [] }),
      'Abra o caixa',
    );
    await recusa(api.caixa.abrir({ valorInicial: 0 }), 'já foi fechado');
  });

  it('comanda a partir do agendamento traz cliente, barbeiro e serviço, sem duplicar', async () => {
    const c = await api.comandas.abrirDoAgendamento(1);
    expect(c).toMatchObject({
      clienteNome: 'Rafael Souza',
      barbeiroNome: 'Zé Carlos',
      total: 70,
    });
    expect((await api.comandas.abrirDoAgendamento(1)).id).toBe(c.id);
    await recusa(api.comandas.abrirDoAgendamento(2), 'confirmado ou atendido');
  });
});

describe('fidelidade e pacotes (planejamento 0015)', () => {
  const receberCom = async (dados: Corpo, forma = 'pix') => {
    const c = await api.comandas.salvar(dados);
    return api.comandas.receber(c.id, { forma });
  };

  it('sem o módulo ativo, receber não credita selos nem cashback', async () => {
    const paga = await receberCom({
      clienteId: 2,
      barbeiroId: 1,
      itens: [{ tipo: 'servico', refId: 1 }],
    });
    expect(paga.creditos).toEqual([]);
  });

  it('com o módulo ativo: 1 selo e 5% de cashback; avulso não acumula', async () => {
    api.definirModulosAtivos(['fidelidade', 'pacotes']);
    const antes = await api.fidelidade.saldo(1);
    expect(antes).toMatchObject({
      selos: 7,
      faltamParaPremio: 3,
      cashback: 3.5,
    });
    const paga = await receberCom({
      clienteId: 1,
      barbeiroId: 1,
      itens: [{ tipo: 'servico', refId: 3 }],
    });
    expect(paga.creditos.map((c) => [c.tipo, c.valor])).toEqual([
      ['selo', 1],
      ['cashback', 3.5],
    ]);
    expect(await api.fidelidade.saldo(1)).toMatchObject({
      selos: 8,
      cashback: 7,
    });
    const avulsa = await receberCom({
      barbeiroId: 1,
      itens: [{ tipo: 'servico', refId: 1 }],
    });
    expect(avulsa.creditos).toEqual([]);
  });

  it('configuração inválida é negada', async () => {
    const cfg = await api.fidelidade.obterConfig();
    await recusa(
      api.fidelidade.salvarConfig({
        ...cfg,
        cashback: { ...cfg.cashback, percentual: 90 },
      }),
      '50%',
    );
  });

  it('usar pacote na comanda: serviço por R$ 0, uso registrado ao receber, limite respeitado', async () => {
    api.definirModulosAtivos(['fidelidade', 'pacotes']);
    const [clube] = await api.assinaturas.doCliente(3);
    expect(clube).toMatchObject({
      vigente: true,
      pacote: { nome: 'Clube do corte' },
    });
    const paga = await receberCom({
      clienteId: 3,
      barbeiroId: 2,
      itens: [{ tipo: 'servico', refId: 1, assinaturaId: clube.id }],
    });
    expect(paga.itens[0]).toMatchObject({ nome: 'Corte (pacote)', preco: 0 });
    expect(paga.total).toBe(0);
    // Serviço usado por pacote não dá selo.
    expect(paga.creditos.filter((c) => c.tipo === 'selo')).toEqual([]);
    const [depois] = await api.assinaturas.doCliente(3);
    expect(depois.saldo.find((s) => s.servicoId === 1)?.usados).toBe(1);
    // Intervalo mínimo de 7 dias para o mesmo serviço.
    await recusa(
      api.comandas.salvar({
        clienteId: 3,
        barbeiroId: 2,
        itens: [{ tipo: 'servico', refId: 1, assinaturaId: clube.id }],
      }),
      'Próximo uso de Corte liberado',
    );
  });

  it('pacote de outro cliente é recusado', async () => {
    const [clube] = await api.assinaturas.doCliente(3);
    await recusa(
      api.comandas.salvar({
        clienteId: 1,
        barbeiroId: 1,
        itens: [{ tipo: 'servico', refId: 1, assinaturaId: clube.id }],
      }),
      'de outro cliente',
    );
  });

  it('vender pacote: abre comanda; o pacote só vale depois de pago', async () => {
    const { assinatura, comandaId } = await api.assinaturas.vender({
      clienteId: 2,
      pacoteId: 2,
      barbeiroId: 1,
    });
    expect(assinatura.estado).toBe('aguardando_pagamento');
    const comanda = await api.comandas.obter(comandaId);
    expect(comanda.itens[0]).toMatchObject({
      tipo: 'pacote',
      nome: 'Pacote: 4 cortes',
      preco: 160,
    });
    expect(
      (
        await api.assinaturas.podeUsar({
          assinaturaId: assinatura.id,
          servicoId: 1,
        })
      ).ok,
    ).toBe(false);
    await api.comandas.receber(comandaId, { forma: 'credito' });
    const [ativa] = await api.assinaturas.doCliente(2);
    expect(ativa).toMatchObject({
      estado: 'ativa',
      inicio: HOJE,
      vigente: true,
    });
    expect(ativa.saldo[0]).toMatchObject({ quantidade: 4, restantes: 4 });
  });

  it('renovar o pacote mensal: uma renovação por vez; o novo mês começa depois do fim', async () => {
    api.definirModulosAtivos(['fidelidade', 'pacotes']);
    const [clube] = await api.assinaturas.doCliente(3);
    const { assinatura, comandaId } = await api.assinaturas.renovar(clube.id, {
      barbeiroId: 2,
    });
    expect(assinatura.estado).toBe('aguardando_pagamento');
    expect(
      (await api.assinaturas.doCliente(3)).find((a) => a.id === clube.id)
        ?.renovacao,
    ).toBe('aguardando_pagamento');
    await recusa(
      api.assinaturas.renovar(clube.id, { barbeiroId: 2 }),
      'aguardando pagamento',
    );
    await api.comandas.receber(comandaId, { forma: 'pix' });
    const nova = (await api.assinaturas.doCliente(3)).find(
      (a) => a.id === assinatura.id,
    );
    expect(nova).toMatchObject({
      estado: 'ativa',
      inicio: somarDias(String(clube.fim), 1),
      vigente: false,
    });
  });

  it('cancelar a comanda da venda cancela o pacote pendente', async () => {
    const { comandaId } = await api.assinaturas.vender({
      clienteId: 2,
      pacoteId: 1,
      barbeiroId: 1,
    });
    await api.comandas.cancelar(comandaId);
    expect(await api.assinaturas.doCliente(2)).toEqual([]);
  });

  it('pacotes: validação, nome repetido e exclusão negada com cliente em vigor', async () => {
    await recusa(
      api.pacotes.salvar({
        nome: 'X',
        preco: 50,
        tipo: 'unico',
        itens: [{ servicoId: 1 }],
      }),
      'validade',
    );
    await recusa(
      api.pacotes.salvar({
        nome: 'clube do CORTE',
        preco: 50,
        tipo: 'recorrente',
        itens: [{ servicoId: 1 }],
      }),
      'Já existe',
    );
    await recusa(api.pacotes.excluir(1), 'com o pacote em vigor');
    const novo = await api.pacotes.salvar({
      nome: 'Barba livre',
      preco: 59.9,
      tipo: 'recorrente',
      itens: [{ servicoId: 2, quantidade: null }],
      limites: { maximoPorSemana: 1 },
    });
    expect(novo).toMatchObject({
      id: 3,
      itens: [{ servicoNome: 'Barba', quantidade: null }],
    });
    await api.pacotes.excluir(3);
  });
});

describe('resumo e comandas do cliente (planejamento 0016)', () => {
  it('resumo: totais por tipo, ticket médio e último serviço com barbeiro', async () => {
    const r = await api.clientes.resumo(1);
    expect(r).toMatchObject({
      comandas: 7,
      totalServicos: 390, // 70 + 45 + 70 + 45 + 70 + 45 + 45
      totalProdutos: 74.8,
      totalGasto: 459.9, // 390 + 74,80 em produtos − 4,90 de desconto
      ultimaVisita: HOJE,
      ultimoServico: {
        nome: 'Corte + barba',
        data: HOJE,
        barbeiroNome: 'Zé Carlos',
      },
      faltas: 0,
    });
  });

  it('comandas em páginas de 5, mais recentes primeiro, com data', async () => {
    const p1 = await api.clientes.comandas(1);
    expect(p1.total).toBe(7);
    expect(p1.itens).toHaveLength(5);
    expect(p1.itens[0]).toMatchObject({ id: 1, data: HOJE, total: 70 });
    const p2 = await api.clientes.comandas(1, { deslocamento: 5 });
    expect(p2.itens.map((c) => c.id)).toEqual([9, 10]);
  });
});
