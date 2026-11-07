import { ref } from 'vue';

/** Fila global de notificações, renderizada pelo DsApp. */
export const filaNotificacoes = ref([]);

const CORES = {
  sucesso: 'success',
  erro: 'error',
  aviso: 'warning',
  info: 'info',
};

export function notificar(tipo, mensagem, { duracao } = {}) {
  filaNotificacoes.value.push({
    text: mensagem,
    color: CORES[tipo],
    timeout: duracao ?? (tipo === 'erro' ? 6000 : 4000),
  });
}
