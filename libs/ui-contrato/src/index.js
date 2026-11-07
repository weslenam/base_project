// Testes de contrato do design system (skill design-system).
// Cada implementação de UI (ui-vuetify, ui-quasar...) chama estas funções nos
// próprios specs, passando seus componentes e sua função `montar`.
// Testam só comportamento observável: texto, eventos, v-model, ARIA.
export { testarInstalarUi } from './instalarUi.contrato.js';
export { testarDsBotao } from './DsBotao.contrato.js';
export { testarDsInput } from './DsInput.contrato.js';
export { testarDsSelect } from './DsSelect.contrato.js';
export { testarDsTabela } from './DsTabela.contrato.js';
export { testarDsDialogo } from './DsDialogo.contrato.js';
export { testarDsLayout } from './DsLayout.contrato.js';
export { testarUseNotificacao } from './useNotificacao.contrato.js';
export { testarUseConfirmacao } from './useConfirmacao.contrato.js';
export { testarUseTema } from './useTema.contrato.js';
