import { ref } from 'vue';

export type TipoDeNotificacao = 'sucesso' | 'erro' | 'aviso' | 'info';

/** Opções de uma notificação. */
export interface OpcoesDeNotificacao {
  /** Em milissegundos. */
  duracao?: number;
}

/** Notificação na fila, no formato do VSnackbarQueue. */
export interface NotificacaoNaFila {
  text: string;
  color: string;
  timeout: number;
}

/** Fila global de notificações, renderizada pelo DsApp. */
export const filaNotificacoes = ref<NotificacaoNaFila[]>([]);

// "aviso" usa o cobre: o âmbar é exclusivo da fila e da hora atual (identidade visual).
const CORES: Record<TipoDeNotificacao, string> = {
  sucesso: 'success',
  erro: 'error',
  aviso: 'primary',
  info: 'info',
};

export function notificar(
  tipo: TipoDeNotificacao,
  mensagem: string,
  { duracao }: OpcoesDeNotificacao = {},
): void {
  filaNotificacoes.value.push({
    text: mensagem,
    color: CORES[tipo],
    timeout: duracao ?? (tipo === 'erro' ? 6000 : 4000),
  });
}
