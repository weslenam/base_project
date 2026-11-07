import { useDialogo } from './useDialogo.js';

/** Atalho para useDialogo().confirmar: devolve Promise<boolean>. */
export function useConfirmacao() {
  return useDialogo().confirmar;
}
