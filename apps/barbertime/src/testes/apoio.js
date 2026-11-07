import { vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { instalarUi } from '@barbertime/ui';
import router from '../router';
import App from '../app/App.vue';

/** Monta o app inteiro na rota pedida (telas, layout e diálogos de verdade). */
export async function montarApp(rota) {
  router.push(rota);
  await router.isReady();
  const alvo = document.createElement('div');
  document.body.appendChild(alvo);
  const wrapper = mount(App, {
    attachTo: alvo,
    global: { plugins: [{ install: instalarUi }, router] },
  });
  await flushPromises();
  return wrapper;
}

export const texto = () => document.body.textContent ?? '';

export async function esperar(asercao) {
  await flushPromises();
  await vi.waitFor(asercao, { timeout: 3000, interval: 20 });
}

/** Todos os botões visíveis com esse texto (o último costuma ser o do diálogo mais recente). */
export const botoes = (rotulo) =>
  [...document.querySelectorAll('button')].filter(
    (b) => b.textContent.trim() === rotulo,
  );

export async function clicar(rotulo, { ultimo = false } = {}) {
  await esperar(() => {
    if (!botoes(rotulo).length)
      throw new Error(`Botão "${rotulo}" não apareceu`);
  });
  const lista = botoes(rotulo);
  (ultimo ? lista.at(-1) : lista[0]).click();
  await flushPromises();
}

/** Campo pelo rótulo visível (label[for]). */
export function campo(rotulo) {
  const label = [...document.querySelectorAll('label')].find(
    (l) => l.textContent.trim() === rotulo && l.htmlFor,
  );
  return label && document.getElementById(label.htmlFor);
}

export async function preencher(rotulo, valor) {
  await esperar(() => {
    if (!campo(rotulo)) throw new Error(`Campo "${rotulo}" não apareceu`);
  });
  const el = campo(rotulo);
  el.value = valor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
}

/** Clica no primeiro botão cujo texto contém o trecho (ex.: opção com nome e detalhe). */
export async function clicarContendo(trecho) {
  const achar = () =>
    [...document.querySelectorAll('button')].find((b) =>
      b.textContent.includes(trecho),
    );
  await esperar(() => {
    if (!achar()) throw new Error(`Nenhum botão com "${trecho}"`);
  });
  achar().click();
  await flushPromises();
}
