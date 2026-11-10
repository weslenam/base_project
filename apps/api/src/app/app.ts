import helmet from '@fastify/helmet';
import type { FastifyError, FastifyInstance } from 'fastify';
import sensible from './plugins/sensible.ts';
import banco from '../infra/banco.ts';
import { config } from '../infra/config.ts';
import autenticacao from '../seguranca/autenticacao.ts';
import identidade from '../identidade/index.ts';
import entrada, { mensagemDeErro } from '../seguranca/entrada.ts';
import limites from '../seguranca/limites.ts';
import type { Limite } from '../seguranca/limites.ts';
import rotasSaude from './rotas/saude.ts';
import { criarCorreioSmtp } from '../infra/correio.ts';
import type { Correio } from '../infra/correio.ts';

// ---- Rotas da operação (planejamento 0040, etapa 6, agente A) ----
import rotasAgenda from './rotas/agenda.js';
import rotasCaixa from './rotas/caixa.js';
import rotasBalcao from './rotas/balcao.js';
import rotasEstoque from './rotas/estoque.js';
import rotasFidelidade from './rotas/fidelidade.js';
import rotasPacotes from './rotas/pacotes.js';
import rotasFinanceiro from './rotas/financeiro.js';

// Separador: os dois blocos ficam longe um do outro para os PRs da etapa 6
// não mexerem em linhas vizinhas.

// ---- Rotas de cadastro, acesso e plataforma (etapa 6, agente B) ----
import rotasAutenticacao from './rotas/autenticacao.ts';
import rotasUsuarios from './rotas/usuarios.ts';
import rotasPapeis from './rotas/papeis.ts';
import rotasModulos from './rotas/modulos.ts';
import rotasPagamentos from './rotas/pagamentos.ts';
import rotasBarbearia from './rotas/barbearia.ts';
import rotasCadastros from './rotas/cadastros.ts';
import rotasClientes from './rotas/clientes.ts';
import rotasPublico from './rotas/publico.ts';
import rotasSenha from './rotas/senha.ts';
import rotasPlataforma from './rotas/plataforma.ts';

/**
 * Aplicação Fastify. Toda rota fica sob /api. Erros esperados saem como
 * { mensagem } com o status certo; os inesperados viram 500 genérico.
 * Proteções contra abuso e entrada maliciosa (ADR 0014): cabeçalhos de
 * segurança, guarda de entrada e limites de requisição. Sem CORS: o front usa a
 * mesma origem.
 */
/** Opções do app (os testes trocam banco, correio e limites). */
export interface OpcoesDoApp {
  databaseUrl?: string;
  auth?: string;
  correio?: Correio;
  appUrl?: string;
  limites?: Record<string, Limite>;
  paginaPublicaLiberada?: boolean;
  pagamentos?: Record<string, unknown>;
}

export async function app(fastify: FastifyInstance, opts: OpcoesDoApp = {}) {
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

  fastify.setErrorHandler((erro: FastifyError, req, reply) => {
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
      api.register(rotasFidelidade);
      api.register(rotasPacotes);
      api.register(rotasFinanceiro);
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
