import type { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/saude', async () => ({ status: 'ok' }));
}
