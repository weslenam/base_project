import { ref } from 'vue';

/** Fila global de notificações, renderizada pelo DsApp. */
export const filaNotificacoes = ref([]);

// "aviso" usa o cobre: o âmbar é exclusivo da fila e da hora atual (identidade visual).
const CORES = {
  sucesso: 'success',
  erro: 'error',
  aviso: 'primary',
  info: 'info',
};

export function notificar(tipo, mensagem, { duracao } = {}) {
  filaNotificacoes.value.push({
    text: mensagem,
    color: CORES[tipo],
    timeout: duracao ?? (tipo === 'erro' ? 6000 : 4000),
  });
}
