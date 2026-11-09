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
export { testarDsIcone } from './DsIcone.contrato.js';
export { testarDsSelo } from './DsSelo.contrato.js';
export { testarDsCartao } from './DsCartao.contrato.js';
export { testarDsIndicador } from './DsIndicador.contrato.js';
export { testarDsHorarios } from './DsHorarios.contrato.js';
export { testarDsBlocoAgenda } from './DsBlocoAgenda.contrato.js';
export {
  testarDsInputTelefone,
  testarDsInputCpf,
  testarDsInputMoeda,
} from './camposBrasileiros.contrato.js';
export { testarUseDialogo } from './useDialogo.contrato.js';
export { testarDsPagina } from './DsPagina.contrato.js';
export { testarDsTextarea } from './DsTextarea.contrato.js';
export { testarDsFormulario } from './DsFormulario.contrato.js';
export { testarDsAcao } from './DsAcao.contrato.js';
export { testarDsAbas } from './DsAbas.contrato.js';
export { testarDsEscolha } from './DsEscolha.contrato.js';
export { testarDsCaixaDeSelecao } from './DsCaixaDeSelecao.contrato.js';
export { testarDsPassos } from './DsPassos.contrato.js';
export { testarDsQrCode } from './DsQrCode.contrato.js';
