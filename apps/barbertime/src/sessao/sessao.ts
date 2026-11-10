import { computed, reactive } from 'vue';
import { papelSemMenu } from '@barbertime/dominio';
import { http, ErroDeSessao } from '../dados/http.ts';
import { api } from '../dados/api.ts';
import type {
  DadosDaSessao,
  EmJson,
  RespostaDaSenha,
} from '@barbertime/contratos';
import type { NomeDoIcone } from '@barbertime/ui';

/** Sessão como chega da API. */
export type Sessao = EmJson<DadosDaSessao>;

/**
 * Sessão do usuário (planejamento 0013): quem é, em qual barbearia, papel,
 * permissões efetivas e módulos ativos, tudo vindo da API (/api/auth/eu).
 * O front só esconde o que não é permitido; quem decide é a API (ADR 0010).
 */
const estado = reactive<{ dados: Sessao | null; carregada: boolean }>({
  dados: null,
  carregada: false,
});

export async function carregarSessao() {
  try {
    definirSessao(await http<Sessao>('GET', '/api/auth/eu'));
  } catch (erro) {
    if (!(erro instanceof ErroDeSessao)) console.error(erro);
    definirSessao(null);
  }
  return estado.dados;
}

/** Define a sessão diretamente (após entrar/cadastrar e nos testes). */
export function definirSessao(dados: Sessao | null): void {
  estado.dados = dados;
  estado.carregada = true;
  // A camada de dados de exemplo precisa saber quais módulos estão ativos.
  api.definirModulosAtivos(dados?.modulosAtivos ?? []);
}

export const sessaoCarregada = () => estado.carregada;
export const temSessao = () => Boolean(estado.dados);

export const pode = (...permissoes: string[]) =>
  permissoes.every((p) => estado.dados?.permissoes?.includes(p));
export const podeAlguma = (...permissoes: string[]) =>
  permissoes.some((p) => estado.dados?.permissoes?.includes(p));
/**
 * Papel sem menu lateral (Barbeiro): abas Balcão e Agenda, mais o Perfil
 * (planejamentos 0035 e 0036). Entra pela primeira aba.
 */
export const semMenu = () => papelSemMenu(estado.dados?.papel?.chave);
export const ABAS_SEM_MENU: {
  titulo: string;
  rota: string;
  icone: NomeDoIcone;
}[] = [
  { titulo: 'Balcão', rota: '/balcao', icone: 'fila' },
  { titulo: 'Agenda', rota: '/agenda', icone: 'agenda' },
];
export const ROTAS_SEM_MENU = [...ABAS_SEM_MENU.map((a) => a.rota), '/perfil'];
export const moduloAtivo = (chave: string) =>
  Boolean(estado.dados?.modulosAtivos?.includes(chave));

export function useSessao() {
  return {
    sessao: computed(() => estado.dados),
    pode,
    podeAlguma,
    moduloAtivo,
    async entrar(email: string, senha: string) {
      definirSessao(
        await http<Sessao>('POST', '/api/auth/entrar', { email, senha }),
      );
    },
    async cadastrar(dados: Record<string, unknown>) {
      definirSessao(await http<Sessao>('POST', '/api/barbearias', dados));
    },
    async trocarBarbearia(barbeariaId: number) {
      definirSessao(
        await http<Sessao>('POST', '/api/auth/barbearia', { barbeariaId }),
      );
    },
    async atualizarPerfil(dados: Record<string, unknown>) {
      definirSessao(await http<Sessao>('PUT', '/api/auth/perfil', dados));
    },
    /** Devolve { ok, sessoesEncerradas }. */
    trocarSenha: (senhaAtual: string, novaSenha: string) =>
      http<{ ok: boolean; sessoesEncerradas: number }>(
        'PUT',
        '/api/auth/senha',
        { senhaAtual, novaSenha },
      ),
    /** Esqueci a senha (planejamento 0023): devolve { ok, mensagem }, sempre igual. */
    pedirRedefinicao: (email: string) =>
      http<RespostaDaSenha>('POST', '/api/auth/esqueci', {
        email,
      }),
    /** Cria a senha nova com o token do link do e-mail. */
    redefinirSenha: (token: string, senha: string) =>
      http<RespostaDaSenha>('POST', '/api/auth/redefinir', { token, senha }),
    async sair() {
      await http('POST', '/api/auth/sair').catch(() => undefined);
      definirSessao(null);
    },
  };
}
