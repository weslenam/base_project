import { notificar } from '../estado/notificacoes.js';

/**
 * Notificações rápidas (toast). Exige um <DsApp> na raiz do app.
 * Pode ser chamado também fora do setup (ex.: interceptor HTTP).
 */
export function useNotificacao() {
  return {
    sucesso: (mensagem, opcoes) => notificar('sucesso', mensagem, opcoes),
    erro: (mensagem, opcoes) => notificar('erro', mensagem, opcoes),
    aviso: (mensagem, opcoes) => notificar('aviso', mensagem, opcoes),
    info: (mensagem, opcoes) => notificar('info', mensagem, opcoes),
  };
}
