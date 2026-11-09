import { vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

/** Texto visível em todo o documento (inclui overlays teleportados para o body). */
export const textoDoDocumento = () => document.body.textContent ?? '';

/** Espera até a asserção passar (transições, teleports, filas). */
export async function esperar(asercao) {
  await flushPromises();
  await vi.waitFor(asercao, { timeout: 2000, interval: 20 });
}

/** Botão do documento pelo texto visível. */
export function botaoPorTexto(texto) {
  return [...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === texto,
  );
}
