import { vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { instalarUi } from '@barbertime/ui';
import router from '../router';
import { definirOperador } from '../sessao/operador.js';
import App from '../app/App.vue';

/**
 * API falsa: `respostas` mapeia "MÉTODO /caminho" para o corpo (ou função que
 * recebe o corpo enviado). As chamadas ficam em `chamadas`.
 */
export function apiFalsa(respostas) {
  const chamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opcoes = {}) => {
      const chave = `${opcoes.method ?? 'GET'} ${url}`;
      const enviado = opcoes.body ? JSON.parse(opcoes.body) : undefined;
      chamadas.push({ chave, corpo: enviado });
      const r = respostas[chave];
      if (r === undefined)
        return new Response(JSON.stringify({ mensagem: 'Entre.' }), {
          status: 401,
        });
      const corpo = typeof r === 'function' ? r(enviado) : r;
      const status = corpo?.status ?? 200;
      return new Response(JSON.stringify(corpo?.corpo ?? corpo), { status });
    }),
  );
  return chamadas;
}

export const OPERADOR = {
  id: 1,
  nome: 'Ana Operadora',
  email: 'ana@barbertime.dev',
};

export async function montarApp(rota, { operador = OPERADOR } = {}) {
  definirOperador(operador);
  await router.push(rota);
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
