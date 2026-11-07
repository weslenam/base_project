// APIs de navegador que o jsdom não traz e a Vuetify usa.
import { afterEach } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { filaNotificacoes } from '../estado/notificacoes.js';
import { filaConfirmacoes } from '../estado/confirmacoes.js';

const nada = () => undefined;

globalThis.ResizeObserver ??= class {
  observe = nada;
  unobserve = nada;
  disconnect = nada;
};

window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: nada,
  removeListener: nada,
  addEventListener: nada,
  removeEventListener: nada,
  dispatchEvent: () => false,
});

window.visualViewport ??= Object.assign(new EventTarget(), {
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
});

Element.prototype.scrollTo ??= nada;

enableAutoUnmount(afterEach);

afterEach(() => {
  filaNotificacoes.value = [];
  filaConfirmacoes.value = [];
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
});
