import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { criarVuetify } from '../instalarUi.js';

const Vazio = { render: () => null };

/** Função `montar` que os testes de contrato recebem: monta com Vuetify e router. */
export function montar(componente, { props, slots } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:caminho(.*)*', component: Vazio }],
  });
  const alvo = document.createElement('div');
  document.body.appendChild(alvo);
  return mount(componente, {
    props,
    slots,
    attachTo: alvo,
    global: { plugins: [criarVuetify(), router] },
  });
}
