import { vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { instalarUi } from '@barbertime/ui';
import router from '../router';
import { definirSessao } from '../sessao/sessao.ts';
import { CHAVES_DE_MODULO, CHAVES_DE_PERMISSAO } from '@barbertime/dominio';
import App from '../app/App.vue';
import type { Sessao } from '../sessao/sessao.ts';

/** Sessão de teste: Dono com todas as permissões e todos os módulos ativos. */
export const SESSAO_DONO: Readonly<Sessao> = Object.freeze({
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
  papel: keyof typeof CHAVE_DO_PAPEL,
  permissoes: string[],
  modulosAtivos: string[] = ['agendamento_online'],
): Sessao => ({
  ...SESSAO_DONO,
  usuario: { id: 9, nome: `Usuário ${papel}`, email: 'x@barbertime.dev' },
  papel: {
    id: 9,
    nome: papel,
    chave: CHAVE_DO_PAPEL[papel],
  },
  permissoes,
  modulosAtivos,
});

/**
 * Monta o app inteiro na rota pedida (telas, layout e diálogos de verdade).
 * Por padrão já entra como Dono; passe { sessao: null } para testar sem login.
 */
export async function montarApp(
  rota: string,
  { sessao = SESSAO_DONO }: { sessao?: Sessao | null } = {},
) {
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

export async function esperar(asercao: () => unknown): Promise<void> {
  await flushPromises();
  await vi.waitFor(asercao, { timeout: 3000, interval: 20 });
}

/** Todos os botões visíveis com esse texto (o último costuma ser o do diálogo mais recente). */
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

/** Campo pelo rótulo visível (label[for]). */
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

/** Clica no primeiro botão cujo texto contém o trecho (ex.: opção com nome e detalhe). */
export async function clicarContendo(trecho: string) {
  const achar = () =>
    [...document.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes(trecho),
    );
  await esperar(() => {
    if (!achar()) throw new Error(`Nenhum botão com "${trecho}"`);
  });
  const botao = achar();
  if (!botao) throw new Error(`Nenhum botão com "${trecho}"`);
  botao.click();
  await flushPromises();
}

/** Resposta simulada: os dados (200) ou uma função do corpo para [status, dados]. */
export type RotaSimulada = unknown | ((corpo: unknown) => [number, unknown]);

/** Chamada que a tela fez à API simulada. */
export interface ChamadaSimulada {
  metodo: string;
  url: string;
  corpo: unknown;
}

/**
 * Simula a API: rotas { 'GET /api/usuarios': dados | (corpo) => [status, dados] }.
 * Devolve a lista de chamadas feitas, para conferir o que a tela enviou.
 */
export function simularApi(
  rotas: Record<string, RotaSimulada>,
): ChamadaSimulada[] {
  const chamadas: ChamadaSimulada[] = [];
  vi.stubGlobal('fetch', async (url: string, opcoes: RequestInit = {}) => {
    const metodo = opcoes.method ?? 'GET';
    const corpo = opcoes.body ? JSON.parse(String(opcoes.body)) : undefined;
    chamadas.push({ metodo, url, corpo });
    const rota = rotas[`${metodo} ${url}`];
    const [status, dados] =
      rota === undefined
        ? [404, { mensagem: `Rota não simulada: ${metodo} ${url}` }]
        : typeof rota === 'function'
          ? (rota as (corpo: unknown) => [number, unknown])(corpo)
          : [200, rota];
    return new Response(status === 204 ? null : JSON.stringify(dados), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return chamadas;
}

/** Abre um DsSelect pelo rótulo e escolhe a opção que contém o texto. */
export async function escolherNoSelect(rotulo: string, textoDaOpcao: string) {
  await esperar(() => {
    if (!campo(rotulo)) throw new Error(`Select "${rotulo}" não apareceu`);
  });
  const caixa = campo(rotulo)
    ?.closest('.v-input')
    ?.querySelector('[role="combobox"]');
  if (!caixa) throw new Error(`Select "${rotulo}" sem a caixa de opções`);
  caixa.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const opcao = () =>
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) =>
      (o.textContent ?? '').includes(textoDaOpcao),
    );
  await esperar(() => {
    if (!opcao()) throw new Error(`Opção "${textoDaOpcao}" não apareceu`);
  });
  const escolhida = opcao();
  if (!escolhida) throw new Error(`Opção "${textoDaOpcao}" não apareceu`);
  escolhida.click();
  await flushPromises();
}

/** App montado por `montarApp`. */
export type AppMontado = Awaited<ReturnType<typeof montarApp>>;

/** Elemento do documento pelo seletor; falha o teste se não existir. */
export function elemento<T extends Element = HTMLElement>(seletor: string): T {
  const el = document.querySelector<T>(seletor);
  if (!el) throw new Error(`Elemento não encontrado: ${seletor}`);
  return el;
}

/** Clica na célula da tabela com exatamente esse texto. */
export function clicarCelula(texto: string): void {
  const celula = [...document.querySelectorAll('td')].find(
    (td) => (td.textContent ?? '').trim() === texto,
  );
  if (!celula) throw new Error(`Célula "${texto}" não apareceu`);
  celula.click();
}

/** Texto com os espaços especiais (ex.: o do R$) trocados por espaço comum. */
export const normalizar = (t: string | null | undefined): string =>
  String(t ?? '').replace(/\s/g, ' ');

/**
 * Clica no primeiro elemento do seletor cujo texto contém o trecho, esperando
 * ele aparecer (como o `clicarContendo`, mas com seletor e região).
 */
export async function clicarEmQueContem(
  seletor: string,
  trecho: string,
  dentro: ParentNode = document,
): Promise<void> {
  const achar = () =>
    [...dentro.querySelectorAll<HTMLElement>(seletor)].find((e) =>
      (e.textContent ?? '').includes(trecho),
    );
  await esperar(() => {
    if (!achar()) throw new Error(`Nenhum "${seletor}" com "${trecho}"`);
  });
  achar()?.click();
  await flushPromises();
}
