import fp from 'fastify-plugin';
import sensible from '@fastify/sensible';

/** Utilitários de erro HTTP (reply.badRequest, reply.notFound...). */
export default fp(async function (fastify) {
  fastify.register(sensible);
});
