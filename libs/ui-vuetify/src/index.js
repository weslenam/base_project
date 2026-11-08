// Implementação ativa do design system (Vuetify, ADR 0007).
// Porta de entrada única: os apps importam só '@barbertime/ui' (alias para cá).

export { instalarUi } from './instalarUi.js';

export { default as DsApp } from './componentes/DsApp.vue';
export { default as DsLayout } from './componentes/DsLayout.vue';
export { default as DsBotao } from './componentes/DsBotao.vue';
export { default as DsInput } from './componentes/DsInput.vue';
export { default as DsSelect } from './componentes/DsSelect.vue';
export { default as DsTabela } from './componentes/DsTabela.vue';
export { default as DsDialogo } from './componentes/DsDialogo.vue';
export { default as DsIcone } from './componentes/DsIcone.vue';
export { default as DsSelo } from './componentes/DsSelo.vue';
export { default as DsCartao } from './componentes/DsCartao.vue';
export { default as DsHorarios } from './componentes/DsHorarios.vue';
export { default as DsBlocoAgenda } from './componentes/DsBlocoAgenda.vue';
export { default as DsInputTelefone } from './componentes/DsInputTelefone.vue';
export { default as DsInputCpf } from './componentes/DsInputCpf.vue';
export { default as DsInputMoeda } from './componentes/DsInputMoeda.vue';
export { default as DsPagina } from './componentes/DsPagina.vue';
export { default as DsAcao } from './componentes/DsAcao.vue';
export { default as DsAbas } from './componentes/DsAbas.vue';
export { default as DsEscolha } from './componentes/DsEscolha.vue';
export { default as DsCaixaDeSelecao } from './componentes/DsCaixaDeSelecao.vue';
export { default as DsPassos } from './componentes/DsPassos.vue';
export { default as DsQrCode } from './componentes/DsQrCode.vue';
export { default as DsFormulario } from './componentes/DsFormulario.vue';
export { default as DsTextarea } from './componentes/DsTextarea.vue';
export { NOMES_DE_ICONES } from './icones.js';

export { useNotificacao } from './composables/useNotificacao.js';
export { useConfirmacao } from './composables/useConfirmacao.js';
export { useDialogo } from './composables/useDialogo.js';
export { useTema } from './composables/useTema.js';
