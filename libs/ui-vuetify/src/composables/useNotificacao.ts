import { notificar } from '../estado/notificacoes.ts';
import type { OpcoesDeNotificacao } from '../estado/notificacoes.ts';
import type { ApiDeNotificacao } from '@barbertime/ui-contrato';

export type { OpcoesDeNotificacao };

/**
 * Notificações rápidas (toast). Exige um <DsApp> na raiz do app.
 * Pode ser chamado também fora do setup (ex.: interceptor HTTP).
 */
export function useNotificacao() {
  return {
    sucesso: (mensagem: string, opcoes?: OpcoesDeNotificacao) =>
      notificar('sucesso', mensagem, opcoes),
    erro: (mensagem: string, opcoes?: OpcoesDeNotificacao) =>
      notificar('erro', mensagem, opcoes),
    aviso: (mensagem: string, opcoes?: OpcoesDeNotificacao) =>
      notificar('aviso', mensagem, opcoes),
    info: (mensagem: string, opcoes?: OpcoesDeNotificacao) =>
      notificar('info', mensagem, opcoes),
  } satisfies ApiDeNotificacao;
}
