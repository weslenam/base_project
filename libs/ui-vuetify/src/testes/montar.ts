import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { criarVuetify } from '../instalarUi.ts';

const Vazio = { render: () => null };

/** Função `montar` que os testes de contrato recebem: monta com Vuetify e router. */
export function montar(
  componente: Component,
  {
    props,
    slots,
  }: { props?: Record<string, unknown>; slots?: Record<string, unknown> } = {},
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:caminho(.*)*', component: Vazio }],
  });
  const alvo = document.createElement('div');
  document.body.appendChild(alvo);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mount(componente as any, {
    props,
    slots,
    attachTo: alvo,
    global: { plugins: [criarVuetify(), router] },
  });
}
