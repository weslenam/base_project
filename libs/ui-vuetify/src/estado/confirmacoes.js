import { ref } from 'vue';

/** Pedidos de confirmação pendentes; o DsApp mostra o primeiro da fila. */
export const filaConfirmacoes = ref([]);

export function pedirConfirmacao(mensagem, opcoes = {}) {
  return new Promise((resolver) => {
    filaConfirmacoes.value.push({
      mensagem,
      titulo: opcoes.titulo ?? 'Confirmação',
      textoOk: opcoes.textoOk ?? 'Confirmar',
      textoCancelar: opcoes.textoCancelar ?? 'Cancelar',
      perigo: opcoes.perigo ?? false,
      resolver,
    });
  });
}

export function responderConfirmacao(resposta) {
  const [atual, ...resto] = filaConfirmacoes.value;
  if (!atual) return;
  filaConfirmacoes.value = resto;
  atual.resolver(resposta);
}
