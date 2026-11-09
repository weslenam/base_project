import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApiHttp } from './apiHttp.js';

// Planejamento 0022 / ADR 0014: o reconhecimento por telefone tem limite contra
// varredura. Barrado, o agendamento segue como "cliente novo".

const resposta = (status, corpo) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(corpo),
  });

afterEach(() => vi.unstubAllGlobals());

describe('página pública: reconhecer por telefone', () => {
  it('limite estourado (429) vira cliente novo, sem erro na tela', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => resposta(429, { mensagem: 'Muitas tentativas seguidas.' })),
    );
    const api = criarApiHttp({});
    await expect(
      api.publico.reconhecer('studio', null, '11987654321'),
    ).resolves.toBeNull();
  });

  it('cliente conhecido continua com o primeiro nome', async () => {
    const fetch = vi.fn(() => resposta(200, { primeiroNome: 'Rafael' }));
    vi.stubGlobal('fetch', fetch);
    const api = criarApiHttp({});
    await expect(
      api.publico.reconhecer('studio', 'abc', '11987654321'),
    ).resolves.toEqual({
      primeiroNome: 'Rafael',
    });
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/publico/studio/cliente?c=abc&telefone=11987654321',
    );
  });

  it('erro do servidor (500) não é engolido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => resposta(500, { mensagem: 'Erro interno.' })),
    );
    const api = criarApiHttp({});
    await expect(
      api.publico.reconhecer('studio', null, '11987654321'),
    ).rejects.toThrow('Erro interno.');
  });
});

describe('fidelidade com a API real', () => {
  const config = (premioServicoId) => ({
    selos: { ativo: true, necessarios: 10, premioServicoId, validadeMeses: 12 },
    cashback: { ativo: true, percentual: 5, validadeDias: 90 },
  });
  const base = {
    fidelidade: {
      salvarConfig: vi.fn(async (c, opcoes) => ({ ...c, opcoes })),
    },
  };

  it('aceita o prêmio que é serviço da barbearia, mesmo fora do catálogo de exemplo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => resposta(200, [{ id: 15, nome: 'Corte' }])),
    );
    const salvo = await criarApiHttp(base).fidelidade.salvarConfig(config(15));
    expect(salvo.opcoes).toEqual({ servicoConferido: true });
  });

  it('prêmio fora dos serviços da barbearia chega vazio, não como id solto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => resposta(200, [{ id: 15, nome: 'Corte' }])),
    );
    const api = criarApiHttp({
      fidelidade: { obterConfig: async () => config(1) },
    });
    expect((await api.fidelidade.obterConfig()).selos.premioServicoId).toBe(
      null,
    );
  });

  it('recusa prêmio que não é serviço da barbearia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => resposta(200, [{ id: 15, nome: 'Corte' }])),
    );
    await expect(
      criarApiHttp(base).fidelidade.salvarConfig(config(99)),
    ).rejects.toThrow('Serviço de prêmio não encontrado.');
  });
});
