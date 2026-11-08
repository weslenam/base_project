import sensible from './plugins/sensible.js';
import banco from '../infra/banco.js';
import { config } from '../infra/config.js';
import autenticacao from '../seguranca/autenticacao.js';
import rotasSaude from './rotas/saude.js';
import rotasAutenticacao from './rotas/autenticacao.js';
import rotasUsuarios from './rotas/usuarios.js';
import rotasPapeis from './rotas/papeis.js';
import rotasModulos from './rotas/modulos.js';
import rotasPagamentos from './rotas/pagamentos.js';
import rotasBarbearia from './rotas/barbearia.js';
import rotasCadastros from './rotas/cadastros.js';
import rotasClientes from './rotas/clientes.js';
import rotasAgenda from './rotas/agenda.js';
import rotasPublico from './rotas/publico.js';

/**
 * Aplicação Fastify. Toda rota fica sob /api. Erros esperados saem como
 * { mensagem } com o status certo; os inesperados viram 500 genérico.
 */
export async function app(fastify, opts = {}) {
  fastify.register(sensible);
  fastify.register(banco, {
    databaseUrl: opts.databaseUrl ?? config.databaseUrl,
  });
  fastify.register(autenticacao);

  fastify.setErrorHandler((erro, req, reply) => {
    const status = erro.statusCode ?? 500;
    if (status >= 500) {
      req.log.error(erro);
      return reply
        .code(500)
        .send({ mensagem: 'Erro interno. Tente de novo em instantes.' });
    }
    return reply.code(status).send({ mensagem: erro.message });
  });

  fastify.register(
    async (api) => {
      api.register(rotasSaude);
      api.register(rotasAutenticacao);
      api.register(rotasUsuarios);
      api.register(rotasPapeis);
      api.register(rotasModulos);
      api.register(rotasBarbearia);
      api.register(rotasCadastros);
      api.register(rotasClientes);
      api.register(rotasAgenda);
      api.register(rotasPublico);
      api.register(rotasPagamentos, opts.pagamentos ?? {});
    },
    { prefix: '/api' },
  );
}
