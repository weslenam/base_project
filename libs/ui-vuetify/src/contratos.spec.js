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
