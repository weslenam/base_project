import { afterEach, describe, expect, it, vi } from 'vitest';
import { aoExpirarSessao, ErroDeSessao, http } from './http.js';

const responder = (status, corpo) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status, ok: status < 400, json: async () => corpo })),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  aoExpirarSessao(() => undefined);
});

describe('http do Business Center', () => {
  it('401 avisa quem trata a sessão expirada e lança ErroDeSessao', async () => {
    const aviso = vi.fn();
    aoExpirarSessao(aviso);
    responder(401, { mensagem: 'Não autenticado.' });
    await expect(
      http('GET', '/api/plataforma/barbearias'),
    ).rejects.toBeInstanceOf(ErroDeSessao);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('outras recusas não mexem na sessão', async () => {
    const aviso = vi.fn();
    aoExpirarSessao(aviso);
    responder(400, { mensagem: 'Informe o motivo.' });
    await expect(http('POST', '/x', {})).rejects.toThrow('Informe o motivo.');
    expect(aviso).not.toHaveBeenCalled();
  });
});
