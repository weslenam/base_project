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

describe('fidelidade com a API real (planejamento 0034)', () => {
  it('configuração e saldo vêm das rotas da API', async () => {
    const fetch = vi.fn((url, op) =>
      url.endsWith('/fidelidade')
        ? resposta(200, { saldo: { selos: 3, cashback: 2.5 }, extrato: [] })
        : resposta(200, { ok: op?.method }),
    );
    vi.stubGlobal('fetch', fetch);
    const api = criarApiHttp({});
    expect(await api.fidelidade.saldo(5)).toEqual({ selos: 3, cashback: 2.5 });
    expect(fetch.mock.calls[0][0]).toBe('/api/clientes/5/fidelidade');
    await api.fidelidade.salvarConfig({ selos: { ativo: false } });
    expect(fetch.mock.calls[1][0]).toBe('/api/fidelidade/config');
    expect(fetch.mock.calls[1][1].method).toBe('PUT');
  });
});
