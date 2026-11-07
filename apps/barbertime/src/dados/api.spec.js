import { describe, it, expect, beforeEach } from 'vitest';
import { criarApi } from './api.js';
import { ErroDeNegocio } from './erros.js';

// Sábado, 7/11/2026, 08:00: antes de qualquer expediente.
const agora = () => new Date(2026, 10, 7, 8, 0);
const HOJE = '2026-11-07';
const AMANHA = '2026-11-08';
let api;

beforeEach(() => {
  api = criarApi({ agora });
});

const recusa = (promessa, trecho) =>
  expect(promessa).rejects.toSatisfy(
    (e) => e instanceof ErroDeNegocio && e.message.includes(trecho),
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
    expect(dia.find((a) => a.estado === 'bloqueado').clienteNome).toBe(
      'Almoço',
    );
  });

  it('horários livres respeitam ocupados e expediente', async () => {
    const livres = await api.agendamentos.horariosLivres({
      data: HOJE,
      barbeiroId: 1,
      servicoId: 1,
    });
    const disponivel = (h) => livres.find((l) => l.hora === h)?.disponivel;
    expect(disponivel('09:00')).toBe(false);
    expect(disponivel('11:00')).toBe(true);
    expect(disponivel('12:30')).toBe(false);
    expect(livres.at(-1).hora).toBe('18:30');
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

  it('cancelar libera o horário', async () => {
    await api.agendamentos.alterarEstado(2, 'cancelado');
    const livres = await api.agendamentos.horariosLivres({
      data: HOJE,
      barbeiroId: 1,
      servicoId: 1,
    });
    expect(livres.find((l) => l.hora === '10:00').disponivel).toBe(true);
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
    expect((await api.produtos.listar()).find((p) => p.id === 5).preco).toBe(
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
