import Fastify from 'fastify';
import { app } from './app.js';

describe('api', () => {
  let server;

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
