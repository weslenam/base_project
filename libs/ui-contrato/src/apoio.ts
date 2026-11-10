import { vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { MountingOptions, VueWrapper } from '@vue/test-utils';
import type { App, Component, ComputedRef } from 'vue';

/**
 * `montar` de cada implementação: monta o componente com o framework de UI
 * dela. O wrapper sai sem tipo de componente: o contrato vale para qualquer um.
 */
export type Montar = (
  componente: Component,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opcoes?: Pick<MountingOptions<any>, 'props' | 'slots'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => VueWrapper<any>;

/** O que o contrato espera do useDialogo. */
export interface ApiDeDialogo {
  confirmar: (mensagem: string, opcoes?: OpcoesDeDialogo) => Promise<boolean>;
  advertir: (mensagem: string, opcoes?: OpcoesDeDialogo) => Promise<boolean>;
  negar: (mensagem: string, opcoes?: OpcoesDeDialogo) => Promise<undefined>;
}
export interface OpcoesDeDialogo {
  titulo?: string;
  textoOk?: string;
  textoCancelar?: string;
  perigo?: boolean;
}

/** O que o contrato espera do useNotificacao. */
export interface ApiDeNotificacao {
  sucesso: (mensagem: string, opcoes?: { duracao?: number }) => void;
  erro: (mensagem: string, opcoes?: { duracao?: number }) => void;
  aviso: (mensagem: string, opcoes?: { duracao?: number }) => void;
  info: (mensagem: string, opcoes?: { duracao?: number }) => void;
}

/** O que o contrato espera do useTema. */
export interface ApiDeTema {
  tema: ComputedRef<string>;
  temas: readonly string[];
  aplicar: (nome: string) => void;
}

/** O que o contrato espera do instalarUi. */
export type InstalarUi = <T extends App>(app: T) => T;

/** Texto visível em todo o documento (inclui overlays teleportados para o body). */
export const textoDoDocumento = () => document.body.textContent ?? '';

/** Espera até a asserção passar (transições, teleports, filas). */
export async function esperar(asercao: () => unknown): Promise<void> {
  await flushPromises();
  await vi.waitFor(asercao, { timeout: 2000, interval: 20 });
}

/** Botão do documento pelo texto visível. */
export function botaoPorTexto(texto: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === texto,
  );
}

/** Clica no botão do documento pelo texto; falha o teste se ele não existir. */
export function clicarBotao(texto: string): void {
  exigir(botaoPorTexto(texto), `botão "${texto}"`).click();
}

/** O valor, ou falha o teste dizendo o que faltou. */
export function exigir<T>(valor: T | null | undefined, oQue: string): T {
  if (valor === null || valor === undefined)
    throw new Error(`Não encontrado: ${oQue}.`);
  return valor;
}
