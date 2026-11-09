// APIs de navegador ausentes no jsdom (usadas pela lib de UI).
const nada = () => undefined;

globalThis.ResizeObserver ??= class {
  observe = nada;
  unobserve = nada;
  disconnect = nada;
};
window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  addListener: nada,
  removeListener: nada,
  addEventListener: nada,
  removeEventListener: nada,
  dispatchEvent: () => false,
});
window.visualViewport ??= Object.assign(new EventTarget(), {
  width: 1024,
  height: 768,
  scale: 1,
});
Element.prototype.scrollTo ??= nada;
