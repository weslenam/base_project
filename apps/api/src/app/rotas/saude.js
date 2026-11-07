export default async function (fastify) {
  fastify.get('/saude', async () => ({ status: 'ok' }));
}
