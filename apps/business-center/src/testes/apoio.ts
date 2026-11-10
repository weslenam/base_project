import { vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { instalarUi } from '@barbertime/ui';
import router from '../router';
import { definirOperador } from '../sessao/operador.ts';
import App from '../app/App.vue';

/**
 * API falsa: `respostas` mapeia "MÉTODO /caminho" para o corpo (ou função que
 * recebe o corpo enviado). As chamadas ficam em `chamadas`.
 */
/** Chamada registrada pela API falsa. */
export interface Chamada {
  chave: string;
  corpo: unknown;
}

export function apiFalsa(respostas: Record<string, unknown>): Chamada[] {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opcoes: RequestInit = {}) => {
      const chave = `${opcoes.method ?? 'GET'} ${url}`;
      const enviado = opcoes.body ? JSON.parse(String(opcoes.body)) : undefined;
      chamadas.push({ chave, corpo: enviado });
      const r = respostas[chave];
      if (r === undefined)
        return new Response(JSON.stringify({ mensagem: 'Entre.' }), {
          status: 401,
        });
      const corpo = (typeof r === 'function' ? r(enviado) : r) as {
        status?: number;
        corpo?: unknown;
      } | null;
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

export async function montarApp(
  rota: string,
  { operador = OPERADOR }: { operador?: typeof OPERADOR | null } = {},
) {
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

export async function esperar(asercao: () => unknown): Promise<void> {
  await flushPromises();
  await vi.waitFor(asercao, { timeout: 3000, interval: 20 });
}

export const botoes = (rotulo: string): HTMLButtonElement[] =>
  [...document.querySelectorAll('button')].filter(
    (b) => (b.textContent ?? '').trim() === rotulo,
  );

export async function clicar(
  rotulo: string,
  { ultimo = false }: { ultimo?: boolean } = {},
) {
  await esperar(() => {
    if (!botoes(rotulo).length)
      throw new Error(`Botão "${rotulo}" não apareceu`);
  });
  const lista = botoes(rotulo);
  const botao = ultimo ? lista.at(-1) : lista[0];
  if (!botao) throw new Error(`Botão "${rotulo}" não apareceu`);
  botao.click();
  await flushPromises();
}

export function campo(rotulo: string): HTMLInputElement | null {
  const label = [...document.querySelectorAll('label')].find(
    (l) => (l.textContent ?? '').trim() === rotulo && l.htmlFor,
  );
  return label
    ? (document.getElementById(label.htmlFor) as HTMLInputElement | null)
    : null;
}

export async function preencher(rotulo: string, valor: string) {
  await esperar(() => {
    if (!campo(rotulo)) throw new Error(`Campo "${rotulo}" não apareceu`);
  });
  const el = campo(rotulo);
  if (!el) throw new Error(`Campo "${rotulo}" não apareceu`);
  el.value = valor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
}
