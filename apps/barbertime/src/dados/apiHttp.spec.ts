import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApiHttp } from './apiHttp.ts';
import type { ConfigFidelidade } from '@barbertime/dominio';
import type { Api } from './tipos.ts';

// Planejamento 0022 / ADR 0014: o reconhecimento por telefone tem limite contra
// varredura. Barrado, o agendamento segue como "cliente novo".

const resposta = (status: number, corpo: unknown) =>
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
    const api = criarApiHttp({} as Api);
    await expect(
      api.publico.reconhecer('studio', undefined, '11987654321'),
    ).resolves.toBeNull();
  });

  it('cliente conhecido continua com o primeiro nome', async () => {
    const fetch = vi.fn<(url: string) => ReturnType<typeof resposta>>(() =>
      resposta(200, { primeiroNome: 'Rafael' }),
    );
    vi.stubGlobal('fetch', fetch);
    const api = criarApiHttp({} as Api);
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
    const api = criarApiHttp({} as Api);
    await expect(
      api.publico.reconhecer('studio', undefined, '11987654321'),
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
    const api = criarApiHttp({} as Api);
    expect(await api.fidelidade.saldo(5)).toEqual({ selos: 3, cashback: 2.5 });
    expect(fetch.mock.calls[0][0]).toBe('/api/clientes/5/fidelidade');
    // Só a parte que a tela mudou: a API completa com o resto da configuração.
    await api.fidelidade.salvarConfig({
      selos: { ativo: false },
    } as ConfigFidelidade);
    expect(fetch.mock.calls[1][0]).toBe('/api/fidelidade/config');
    expect(fetch.mock.calls[1][1].method).toBe('PUT');
  });
});

describe('pacotes com a API real (planejamento 0034, etapa B)', () => {
  it('venda, renovação e pré-checagem usam as rotas da API', async () => {
    const fetch = vi.fn((url, op) =>
      resposta(200, { url, metodo: op?.method }),
    );
    vi.stubGlobal('fetch', fetch);
    const api = criarApiHttp({} as Api);
    await api.assinaturas.doCliente(5);
    await api.assinaturas.vender({ clienteId: 5, pacoteId: 2, barbeiroId: 1 });
    await api.assinaturas.renovar(9, { barbeiroId: 1 });
    await api.assinaturas.podeUsar({ assinaturaId: 9, servicoId: 3 });
    await api.pacotes.excluir(2);
    expect(fetch.mock.calls.map(([url, op]) => `${op.method} ${url}`)).toEqual([
      'GET /api/clientes/5/assinaturas',
      'POST /api/assinaturas',
      'POST /api/assinaturas/9/renovar',
      'POST /api/assinaturas/9/pode-usar',
      'DELETE /api/pacotes/2',
    ]);
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({
      servicoId: 3,
      jaNaComanda: [],
    });
  });
});
