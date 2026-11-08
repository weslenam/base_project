import { describe } from 'vitest';
import {
  testarInstalarUi,
  testarDsBotao,
  testarDsInput,
  testarDsSelect,
  testarDsTabela,
  testarDsDialogo,
  testarDsLayout,
  testarUseNotificacao,
  testarUseConfirmacao,
  testarUseTema,
  testarDsIcone,
  testarDsSelo,
  testarDsCartao,
  testarDsHorarios,
  testarDsBlocoAgenda,
  testarDsInputTelefone,
  testarDsInputCpf,
  testarDsInputMoeda,
  testarUseDialogo,
  testarDsPagina,
  testarDsTextarea,
  testarDsFormulario,
  testarDsAcao,
  testarDsAbas,
  testarDsEscolha,
  testarDsCaixaDeSelecao,
  testarDsPassos,
  testarDsQrCode,
} from '@barbertime/ui-contrato';
import {
  instalarUi,
  DsApp,
  DsLayout,
  DsBotao,
  DsInput,
  DsSelect,
  DsTabela,
  DsDialogo,
  useNotificacao,
  useConfirmacao,
  useTema,
  DsIcone,
  NOMES_DE_ICONES,
  DsSelo,
  DsCartao,
  DsHorarios,
  DsBlocoAgenda,
  DsInputTelefone,
  DsInputCpf,
  DsInputMoeda,
  useDialogo,
  DsPagina,
  DsTextarea,
  DsFormulario,
  DsAcao,
  DsAbas,
  DsEscolha,
  DsCaixaDeSelecao,
  DsPassos,
  DsQrCode,
} from './index.js';
import { montar } from './testes/montar.js';

describe('Vuetify: instalarUi', () => testarInstalarUi(instalarUi));
describe('Vuetify: DsBotao', () => testarDsBotao(DsBotao, montar));
describe('Vuetify: DsInput', () => testarDsInput(DsInput, montar));
describe('Vuetify: DsSelect', () => testarDsSelect(DsSelect, montar));
describe('Vuetify: DsTabela', () => testarDsTabela(DsTabela, montar));
describe('Vuetify: DsDialogo', () => testarDsDialogo(DsDialogo, montar));
describe('Vuetify: DsLayout', () =>
  testarDsLayout({ DsApp, DsLayout }, montar));
describe('Vuetify: useNotificacao', () =>
  testarUseNotificacao({ DsApp, useNotificacao }, montar));
describe('Vuetify: useConfirmacao', () =>
  testarUseConfirmacao({ DsApp, useConfirmacao }, montar));
describe('Vuetify: useTema', () => testarUseTema(useTema, montar));
describe('Vuetify: DsIcone', () =>
  testarDsIcone({ DsIcone, NOMES_DE_ICONES }, montar));
describe('Vuetify: DsSelo', () => testarDsSelo(DsSelo, montar));
describe('Vuetify: DsCartao', () => testarDsCartao(DsCartao, montar));
describe('Vuetify: DsHorarios', () => testarDsHorarios(DsHorarios, montar));
describe('Vuetify: DsBlocoAgenda', () =>
  testarDsBlocoAgenda(DsBlocoAgenda, montar));
describe('Vuetify: DsInputTelefone', () =>
  testarDsInputTelefone(DsInputTelefone, montar));
describe('Vuetify: DsInputCpf', () => testarDsInputCpf(DsInputCpf, montar));
describe('Vuetify: DsInputMoeda', () =>
  testarDsInputMoeda(DsInputMoeda, montar));
describe('Vuetify: useDialogo', () =>
  testarUseDialogo({ DsApp, useDialogo }, montar));
describe('Vuetify: DsPagina', () => testarDsPagina(DsPagina, montar));
describe('Vuetify: DsTextarea', () => testarDsTextarea(DsTextarea, montar));
describe('Vuetify: DsFormulario', () =>
  testarDsFormulario({ DsFormulario, DsInput, DsBotao }, montar));
describe('Vuetify: DsAcao', () => testarDsAcao(DsAcao, montar));
describe('Vuetify: DsAbas', () => testarDsAbas(DsAbas, montar));
describe('Vuetify: DsEscolha', () => testarDsEscolha(DsEscolha, montar));
describe('Vuetify: DsCaixaDeSelecao', () =>
  testarDsCaixaDeSelecao(DsCaixaDeSelecao, montar));
describe('Vuetify: DsPassos', () => testarDsPassos(DsPassos, montar));
describe('Vuetify: DsQrCode', () => testarDsQrCode(DsQrCode, montar));
