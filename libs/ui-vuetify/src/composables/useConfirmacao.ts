import { useDialogo } from './useDialogo.ts';

/** Atalho para useDialogo().confirmar: devolve Promise<boolean>. */
export function useConfirmacao() {
  return useDialogo().confirmar;
}
