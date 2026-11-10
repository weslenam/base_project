import { afterEach, describe, expect, it, vi } from 'vitest';
import { permissoesDoPapel } from '@barbertime/dominio';
import {
  clicar,
  clicarContendo,
  elemento,
  esperar,
  montarApp,
  sessaoCom,
  simularApi,
  texto,
} from '../testes/apoio.ts';
import type { AppMontado } from '../testes/apoio.ts';

// Planejamento 0020 (fase 1): tela do Balcão com a API simulada.

let app: AppMontado | undefined;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const PAINEL = (extra = {}) => ({
  data: '2026-11-07',
  agora: '14:00',
  config: { folgaMinutos: 5, toleranciaMinutos: 10, exigirTelefone: false },
  caixaAberto: true,
  barbeiros: [
    {
      id: 1,
      nome: 'João',
      usuarioId: null as number | null,
      estado: 'ocupado',
      restanteMin: 20,
      atual: {
        id: 50,
        clienteNome: 'Carlos',
        servicoNome: 'Corte',
        comandaId: 7,
      },
      proximo: { id: 60, inicio: '15:00', clienteNome: 'Ana' },
    },
    {
      id: 2,
      nome: 'Léo',
      usuarioId: null as number | null,
      estado: 'livre',
      restanteMin: 0,
      atual: null,
      proximo: null,
    },
  ],
  fila: [
    {
      id: 70,
      estado: 'na_fila',
      clienteNome: 'Cliente balcão',
      servicoNome: 'Barba',
      barbeiroId: null,
      chegouAs: '13:55',
      podeAgora: true,
      esperaMin: 0,
      barbeiroSugeridoId: 2,
    },
  ],
  proximos: [
    {
      id: 60,
      inicio: '15:00',
      clienteNome: 'Ana',
      servicoNome: 'Corte',
      barbeiroNome: 'João',
    },
  ],
  atrasados: [],
  aCobrar: [],
  servicos: [
    { id: 1, nome: 'Corte', duracao: 30, preco: 45, vendas: 9 },
    { id: 2, nome: 'Barba', duracao: 20, preco: 30, vendas: 4 },
  ],
  ...extra,
});

describe('balcão', () => {
  it('mostra Agora, Fila e Próximos', async () => {
    simularApi({ 'GET /api/balcao': PAINEL() });
    app = await montarApp('/balcao');
    await esperar(() =>
      expect(texto()).toContain('Pode começar agora com Léo'),
    );
    const agora = elemento('section[aria-label="Agora"]').textContent;
    expect(agora).toMatch(/João.*Ocupado · 20 min/);
    expect(agora).toContain('Próximo: 15:00 Ana');
    expect(elemento('section[aria-label="Próximos"]').textContent).toContain(
      'Ana',
    );
  });

  it('iniciar usa o barbeiro sugerido; check-in chama a API', async () => {
    const chamadas = simularApi({
      'GET /api/balcao': PAINEL(),
      'POST /api/atendimentos/70/iniciar': {
        id: 70,
        clienteNome: 'Cliente balcão',
        barbeiroNome: 'Léo',
      },
      'POST /api/atendimentos/60/checkin': { id: 60, clienteNome: 'Ana' },
    });
    app = await montarApp('/balcao');
    await clicar('Iniciar');
    await esperar(() => expect(texto()).toContain('começou com Léo'));
    expect(chamadas.find((c) => c.url.endsWith('/iniciar'))?.corpo).toEqual({
      barbeiroId: 2,
    });
    await clicar('Check-in');
    await esperar(() =>
      expect(
        chamadas.some((c) => c.url === '/api/atendimentos/60/checkin'),
      ).toBe(true),
    );
  });

  it('avulso em 3 toques: serviço, primeiro livre, pular', async () => {
    const chamadas = simularApi({
      'GET /api/balcao': PAINEL(),
      'GET /api/balcao/encaixe?servicoId=2': {
        porBarbeiro: [
          {
            barbeiroId: 1,
            barbeiroNome: 'João',
            estado: 'ocupado',
            podeAgora: false,
            inicioPrevisto: '14:20',
            esperaMin: 20,
          },
          {
            barbeiroId: 2,
            barbeiroNome: 'Léo',
            estado: 'livre',
            podeAgora: true,
            inicioPrevisto: '14:00',
            esperaMin: 0,
          },
        ],
        primeiroLivre: { barbeiroId: 2, barbeiroNome: 'Léo', esperaMin: 0 },
      },
      'POST /api/balcao/avulsos': {
        id: 71,
        clienteNome: 'Cliente balcão',
        servicoNome: 'Barba',
      },
    });
    app = await montarApp('/balcao');
    await esperar(() => expect(texto()).toContain('Fila e chegadas'));
    await clicarContendo('Avulso');
    await clicarContendo('20 min · R$'); // 1: Barba
    await esperar(() => expect(texto()).toContain('~20 min'));
    expect(texto()).toContain('Léo · agora'); // 2: primeiro livre já escolhido
    await clicarContendo('Pular'); // 3
    await esperar(() =>
      expect(texto()).toContain('Cliente balcão entrou na fila (Barba)'),
    );
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      servicoId: 2,
      barbeiroId: null,
      telefone: null,
      nome: null,
    });
  });

  it('caixa fechado: pede para abrir antes do avulso', async () => {
    const chamadas = simularApi({
      'GET /api/balcao': PAINEL({ caixaAberto: false }),
      'POST /api/caixa/abrir': { aberto: true },
    });
    app = await montarApp('/balcao');
    await esperar(() => expect(texto()).toContain('abra o caixa de hoje'));
    await clicar('Abrir caixa');
    await esperar(() =>
      expect(chamadas.some((c) => c.url === '/api/caixa/abrir')).toBe(true),
    );
  });
});

// Planejamento 0036: o Barbeiro (conta 9 = João) só vê as ações sobre si.
describe('balcão do Barbeiro', () => {
  it('finaliza e pausa só o próprio; não inicia a fila sugerida a outro', async () => {
    const painel = PAINEL();
    painel.barbeiros[0].usuarioId = 9;
    painel.barbeiros[1].usuarioId = 3;
    simularApi({ 'GET /api/balcao': painel });
    app = await montarApp('/balcao', {
      sessao: sessaoCom('Barbeiro', permissoesDoPapel('barbeiro')),
    });
    await esperar(() =>
      expect(texto()).toContain('Pode começar agora com Léo'),
    );
    const agora = (nome: string) =>
      elemento(`article[aria-label="${nome}"]`).textContent;
    expect(agora('João')).toContain('Finalizar');
    expect(agora('João')).toContain('Pausa');
    expect(agora('Léo')).not.toContain('Pausa');
    const fila = elemento('ol[aria-label="Fila"]').textContent;
    expect(fila).not.toContain('Iniciar');
    expect(fila).not.toContain('Desistiu');
    // Check-in e as abas Balcão / Agenda continuam.
    expect(texto()).toContain('Check-in');
    const abas = elemento('[aria-label="Navegação principal"]');
    expect(abas.textContent).toContain('Balcão');
    expect(abas.textContent).toContain('Agenda');
  });
});

describe('caixa fechado no balcão (planejamento 0039)', () => {
  it('Barbeiro vê o aviso para pedir a abertura, sem o botão', async () => {
    simularApi({ 'GET /api/balcao': PAINEL({ caixaAberto: false }) });
    app = await montarApp('/balcao', {
      sessao: sessaoCom('Barbeiro', permissoesDoPapel('barbeiro')),
    });
    await esperar(() => expect(texto()).toContain('Peça à recepção'));
    expect(texto()).not.toContain('Abrir caixa');
  });

  it('a Recepção abre o caixa', async () => {
    simularApi({ 'GET /api/balcao': PAINEL({ caixaAberto: false }) });
    app = await montarApp('/balcao', {
      sessao: sessaoCom('Recepção', permissoesDoPapel('recepcao')),
    });
    await esperar(() => expect(texto()).toContain('Abrir caixa'));
  });
});
