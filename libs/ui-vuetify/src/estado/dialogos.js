import { ref } from 'vue';

/**
 * Diálogos padronizados (planejamento 0006). O DsApp mostra o primeiro da fila.
 * - confirmacao: pergunta sim/não → true/false
 * - advertencia: alerta antes de seguir → true (continuar) / false (voltar)
 * - negacao: ação recusada, só informa → undefined
 */
export const PADROES_DE_DIALOGO = Object.freeze({
  confirmacao: {
    titulo: 'Confirmação',
    textoOk: 'Confirmar',
    textoCancelar: 'Cancelar',
    icone: 'info',
  },
  advertencia: {
    titulo: 'Atenção',
    textoOk: 'Continuar',
    textoCancelar: 'Voltar',
    icone: 'alerta',
  },
  negacao: {
    titulo: 'Não foi possível',
    textoOk: 'Entendi',
    textoCancelar: null,
    icone: 'bloqueio',
  },
});

export const filaDialogos = ref([]);

export function abrirDialogo(tipo, mensagem, opcoes = {}) {
  const padrao = PADROES_DE_DIALOGO[tipo];
  return new Promise((resolver) => {
    filaDialogos.value.push({
      tipo,
      mensagem,
      titulo: opcoes.titulo ?? padrao.titulo,
      textoOk: opcoes.textoOk ?? padrao.textoOk,
      textoCancelar:
        tipo === 'negacao'
          ? null
          : (opcoes.textoCancelar ?? padrao.textoCancelar),
      icone: padrao.icone,
      perigo: tipo === 'confirmacao' && Boolean(opcoes.perigo),
      resolver,
    });
  });
}

export function responderDialogo(resposta) {
  const [atual, ...resto] = filaDialogos.value;
  if (!atual) return;
  filaDialogos.value = resto;
  atual.resolver(atual.tipo === 'negacao' ? undefined : resposta);
}

/** Fecha todos os diálogos pendentes (ex.: o DsApp saiu da tela). Respondem como "cancelar". */
export function descartarDialogos() {
  const pendentes = filaDialogos.value;
  filaDialogos.value = [];
  for (const d of pendentes)
    d.resolver(d.tipo === 'negacao' ? undefined : false);
}
