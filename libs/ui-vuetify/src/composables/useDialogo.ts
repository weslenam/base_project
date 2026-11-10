import { abrirDialogo } from '../estado/dialogos.ts';
import type { OpcoesDeDialogo } from '../estado/dialogos.ts';
import type { ApiDeDialogo } from '@barbertime/ui-contrato';

export type { OpcoesDeDialogo };

/**
 * Diálogos de confirmação, advertência e negação. Exige um <DsApp> na raiz.
 * Pode ser chamado também fora do setup.
 *
 *   const { confirmar, advertir, negar } = useDialogo();
 *   if (await confirmar('Excluir o cliente?', { perigo: true, textoOk: 'Excluir' })) ...
 *   if (await advertir('Fora do expediente. Marcar mesmo assim?')) ...
 *   await negar('Esse horário acabou de ser ocupado. Escolha outro.');
 *
 * Opções: { titulo, textoOk, textoCancelar, perigo (só confirmar) }.
 */
export function useDialogo() {
  return {
    confirmar: (mensagem: string, opcoes?: OpcoesDeDialogo) =>
      abrirDialogo('confirmacao', mensagem, opcoes),
    advertir: (mensagem: string, opcoes?: OpcoesDeDialogo) =>
      abrirDialogo('advertencia', mensagem, opcoes),
    negar: (mensagem: string, opcoes?: OpcoesDeDialogo) =>
      abrirDialogo('negacao', mensagem, opcoes),
  } satisfies ApiDeDialogo;
}
