import { describe, it, expect } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { instalarUi } from '@barbertime/ui';
import router from '../router';
import App from './App.vue';

async function montarEm(rota) {
  router.push(rota);
  await router.isReady();
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [{ install: instalarUi }, router] },
  });
  await flushPromises();
  return wrapper;
}

describe('App', () => {
  it('renderiza layout e tela inicial', async () => {
    const w = await montarEm('/');
    expect(w.text()).toContain('BarberTime');
    expect(w.text()).toContain('Workspace pronto');
    expect(w.text()).toContain('Componentes');
    w.unmount();
  });

  it('abre a vitrine de componentes', async () => {
    const w = await montarEm('/componentes');
    expect(w.text()).toContain('Botões');
    expect(w.text()).toContain('Corte + barba');
    w.unmount();
  });
});
