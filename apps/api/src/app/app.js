import sensible from './plugins/sensible.js';
import rotasSaude from './rotas/saude.js';

/**
 * Aplicação Fastify. Plugins e rotas são registrados explicitamente;
 * toda rota fica sob o prefixo /api.
 */
export async function app(fastify) {
  fastify.register(sensible);
  fastify.register(rotasSaude, { prefix: '/api' });
}
