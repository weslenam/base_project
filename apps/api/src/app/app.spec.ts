import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { app } from './app.ts';

import { readFileSync } from 'node:fs';

describe('#34: versão do Node', () => {
  it('#34: engines exige o Node que roda .ts direto (22.18 ou mais novo)', () => {
    const raiz = JSON.parse(
      readFileSync(
        new URL('../../../../package.json', import.meta.url),
        'utf8',
      ),
    );
    expect(raiz.engines.node).toBe('>=22.18');
    expect(process.features.typescript).toBeTruthy();
  });
});

describe('api', () => {
  let server: FastifyInstance;

  beforeEach(() => {
    server = Fastify();
    server.register(app);
  });

  afterEach(() => server.close());

  it('GET /api/saude responde ok', async () => {
    const resposta = await server.inject({ method: 'GET', url: '/api/saude' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok' });
  });

  it('rota inexistente responde 404', async () => {
    const resposta = await server.inject({
      method: 'GET',
      url: '/api/nao-existe',
    });
    expect(resposta.statusCode).toBe(404);
  });
});
