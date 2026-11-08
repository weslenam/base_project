import { computed, reactive } from 'vue';
import { http, ErroDeSessao } from '../dados/http.js';
import { api } from '../dados/api.js';

/**
 * Sessão do usuário (planejamento 0013): quem é, em qual barbearia, papel,
 * permissões efetivas e módulos ativos, tudo vindo da API (/api/auth/eu).
 * O front só esconde o que não é permitido; quem decide é a API (ADR 0010).
 */
const estado = reactive({ dados: null, carregada: false });

export async function carregarSessao() {
  try {
    definirSessao(await http('GET', '/api/auth/eu'));
  } catch (erro) {
    if (!(erro instanceof ErroDeSessao)) console.error(erro);
    definirSessao(null);
  }
  return estado.dados;
}

/** Define a sessão diretamente (após entrar/cadastrar e nos testes). */
export function definirSessao(dados) {
  estado.dados = dados;
  estado.carregada = true;
  // A camada de dados de exemplo precisa saber quais módulos estão ativos.
  api.definirModulosAtivos(dados?.modulosAtivos ?? []);
}

export const sessaoCarregada = () => estado.carregada;
export const temSessao = () => Boolean(estado.dados);

export const pode = (...permissoes) =>
  permissoes.every((p) => estado.dados?.permissoes?.includes(p));
export const podeAlguma = (...permissoes) =>
  permissoes.some((p) => estado.dados?.permissoes?.includes(p));
export const moduloAtivo = (chave) =>
  Boolean(estado.dados?.modulosAtivos?.includes(chave));

export function useSessao() {
  return {
    sessao: computed(() => estado.dados),
    pode,
    podeAlguma,
    moduloAtivo,
    async entrar(email, senha) {
      definirSessao(await http('POST', '/api/auth/entrar', { email, senha }));
    },
    async cadastrar(dados) {
      definirSessao(await http('POST', '/api/barbearias', dados));
    },
    async trocarBarbearia(barbeariaId) {
      definirSessao(await http('POST', '/api/auth/barbearia', { barbeariaId }));
    },
    async atualizarPerfil(dados) {
      definirSessao(await http('PUT', '/api/auth/perfil', dados));
    },
    /** Devolve { ok, sessoesEncerradas }. */
    trocarSenha: (senhaAtual, novaSenha) =>
      http('PUT', '/api/auth/senha', { senhaAtual, novaSenha }),
    /** Esqueci a senha (planejamento 0023): devolve { ok, mensagem }, sempre igual. */
    pedirRedefinicao: (email) => http('POST', '/api/auth/esqueci', { email }),
    /** Cria a senha nova com o token do link do e-mail. */
    redefinirSenha: (token, senha) =>
      http('POST', '/api/auth/redefinir', { token, senha }),
    async sair() {
      await http('POST', '/api/auth/sair').catch(() => undefined);
      definirSessao(null);
    },
  };
}
