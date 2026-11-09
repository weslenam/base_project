import { vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { instalarUi } from '@barbertime/ui';
import router from '../router';
import { definirSessao } from '../sessao/sessao.js';
import { CHAVES_DE_MODULO, CHAVES_DE_PERMISSAO } from '@barbertime/dominio';
import App from '../app/App.vue';

/** Sessão de teste: Dono com todas as permissões e todos os módulos ativos. */
export const SESSAO_DONO = Object.freeze({
  usuario: { id: 1, nome: 'Zé Carlos', email: 'dono@barbertime.dev' },
  barbearia: { id: 1, nome: 'Barbearia do Zé', slug: 'barbearia-modelo' },
  barbearias: [{ id: 1, nome: 'Barbearia do Zé', slug: 'barbearia-modelo' }],
  papel: { id: 1, nome: 'Dono', chave: 'dono' },
  permissoes: [...CHAVES_DE_PERMISSAO],
  modulosAtivos: [...CHAVES_DE_MODULO],
});

const CHAVE_DO_PAPEL = {
  Dono: 'dono',
  Gerente: 'gerente',
  Recepção: 'recepcao',
  Barbeiro: 'barbeiro',
};

export const sessaoCom = (
  papel,
  permissoes,
  modulosAtivos = ['agendamento_online'],
) => ({
  ...SESSAO_DONO,
  usuario: { id: 9, nome: `Usuário ${papel}`, email: 'x@barbertime.dev' },
  papel: { id: 9, nome: papel, chave: CHAVE_DO_PAPEL[papel] ?? null },
  permissoes,
  modulosAtivos,
});

/**
 * Monta o app inteiro na rota pedida (telas, layout e diálogos de verdade).
 * Por padrão já entra como Dono; passe { sessao: null } para testar sem login.
 */
export async function montarApp(rota, { sessao = SESSAO_DONO } = {}) {
  definirSessao(sessao);
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

/**
 * Simula a API: rotas { 'GET /api/usuarios': dados | (corpo) => [status, dados] }.
 * Devolve a lista de chamadas feitas, para conferir o que a tela enviou.
 */
export function simularApi(rotas) {
  const chamadas = [];
  vi.stubGlobal('fetch', async (url, opcoes = {}) => {
    const metodo = opcoes.method ?? 'GET';
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : undefined;
    chamadas.push({ metodo, url, corpo });
    const rota = rotas[`${metodo} ${url}`];
    const [status, dados] =
      rota === undefined
        ? [404, { mensagem: `Rota não simulada: ${metodo} ${url}` }]
        : typeof rota === 'function'
          ? rota(corpo)
          : [200, rota];
    return new Response(status === 204 ? null : JSON.stringify(dados), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return chamadas;
}

/** Abre um DsSelect pelo rótulo e escolhe a opção que contém o texto. */
export async function escolherNoSelect(rotulo, textoDaOpcao) {
  await esperar(() => {
    if (!campo(rotulo)) throw new Error(`Select "${rotulo}" não apareceu`);
  });
  const caixa = campo(rotulo)
    .closest('.v-input')
    .querySelector('[role="combobox"]');
  caixa.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const opcao = () =>
    [...document.querySelectorAll('[role="option"]')].find((o) =>
      o.textContent.includes(textoDaOpcao),
    );
  await esperar(() => {
    if (!opcao()) throw new Error(`Opção "${textoDaOpcao}" não apareceu`);
  });
  opcao().click();
  await flushPromises();
}
