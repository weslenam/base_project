import helmet from '@fastify/helmet';
import sensible from './plugins/sensible.js';
import banco from '../infra/banco.js';
import { config } from '../infra/config.js';
import autenticacao from '../seguranca/autenticacao.js';
import identidade from '../identidade/index.js';
import entrada, { mensagemDeErro } from '../seguranca/entrada.js';
import limites from '../seguranca/limites.js';
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
import rotasCaixa from './rotas/caixa.js';
import rotasBalcao from './rotas/balcao.js';
import rotasEstoque from './rotas/estoque.js';
import rotasSenha from './rotas/senha.js';
import rotasPlataforma from './rotas/plataforma.js';
import { criarCorreioSmtp } from '../infra/correio.js';

/**
 * Aplicação Fastify. Toda rota fica sob /api. Erros esperados saem como
 * { mensagem } com o status certo; os inesperados viram 500 genérico.
 * Proteções contra abuso e entrada maliciosa (ADR 0014): cabeçalhos de
 * segurança, guarda de entrada e limites de requisição. Sem CORS: o front usa a
 * mesma origem.
 */
export async function app(fastify, opts = {}) {
  fastify.register(helmet);
  fastify.register(entrada);
  fastify.register(limites, { limites: opts.limites });
  fastify.register(sensible);
  fastify.register(banco, {
    databaseUrl: opts.databaseUrl ?? config.databaseUrl,
  });
  fastify.register(identidade, {
    auth: opts.auth,
    correio: opts.correio ?? criarCorreioSmtp(config.smtpUrl, config.remetente),
    appUrl: opts.appUrl ?? config.appUrl,
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
    return reply.code(status).send({ mensagem: mensagemDeErro(erro, status) });
  });

  fastify.register(
    async (api) => {
      api.register(rotasSaude);
      api.register(rotasAutenticacao);
      api.register(rotasSenha);
      api.register(rotasUsuarios);
      api.register(rotasPapeis);
      api.register(rotasModulos);
      api.register(rotasBarbearia, {
        paginaPublicaLiberada:
          opts.paginaPublicaLiberada ?? config.paginaPublicaLiberada,
      });
      api.register(rotasCadastros);
      api.register(rotasClientes);
      api.register(rotasAgenda);
      api.register(rotasCaixa);
      api.register(rotasBalcao);
      api.register(rotasEstoque);
      api.register(rotasPublico, {
        liberada: opts.paginaPublicaLiberada ?? config.paginaPublicaLiberada,
      });
      api.register(rotasPagamentos, opts.pagamentos ?? {});
      // Business Center (planejamento 0028): identidade de operador, escopo próprio.
      api.register(rotasPlataforma, { prefix: '/plataforma' });
    },
    { prefix: '/api' },
  );
}
