// Testes de contrato do design system (skill design-system).
// Cada implementação de UI (ui-vuetify, ui-quasar...) chama estas funções nos
// próprios specs, passando seus componentes e sua função `montar`.
// Testam só comportamento observável: texto, eventos, v-model, ARIA.
export { testarInstalarUi } from './instalarUi.contrato.ts';
export { testarDsBotao } from './DsBotao.contrato.ts';
export { testarDsInput } from './DsInput.contrato.ts';
export { testarDsSelect } from './DsSelect.contrato.ts';
export { testarDsTabela } from './DsTabela.contrato.ts';
export { testarDsDialogo } from './DsDialogo.contrato.ts';
export { testarDsLayout } from './DsLayout.contrato.ts';
export { testarUseNotificacao } from './useNotificacao.contrato.ts';
export { testarUseConfirmacao } from './useConfirmacao.contrato.ts';
export { testarUseTema } from './useTema.contrato.ts';
export { testarDsIcone } from './DsIcone.contrato.ts';
export { testarDsSelo } from './DsSelo.contrato.ts';
export { testarDsCartao } from './DsCartao.contrato.ts';
export { testarDsIndicador } from './DsIndicador.contrato.ts';
export { testarDsHorarios } from './DsHorarios.contrato.ts';
export { testarDsBlocoAgenda } from './DsBlocoAgenda.contrato.ts';
export {
  testarDsInputTelefone,
  testarDsInputCpf,
  testarDsInputMoeda,
} from './camposBrasileiros.contrato.ts';
export { testarUseDialogo } from './useDialogo.contrato.ts';
export { testarDsPagina } from './DsPagina.contrato.ts';
export { testarDsTextarea } from './DsTextarea.contrato.ts';
export { testarDsFormulario } from './DsFormulario.contrato.ts';
export { testarDsAcao } from './DsAcao.contrato.ts';
export { testarDsAbas } from './DsAbas.contrato.ts';
export { testarDsEscolha } from './DsEscolha.contrato.ts';
export { testarDsCaixaDeSelecao } from './DsCaixaDeSelecao.contrato.ts';
export { testarDsPassos } from './DsPassos.contrato.ts';
export { testarDsQrCode } from './DsQrCode.contrato.ts';
export type {
  ApiDeDialogo,
  ApiDeNotificacao,
  ApiDeTema,
  InstalarUi,
  Montar,
  OpcoesDeDialogo,
} from './apoio.ts';
