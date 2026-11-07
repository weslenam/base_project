import { abrirDialogo } from '../estado/dialogos.js';

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
    confirmar: (mensagem, opcoes) =>
      abrirDialogo('confirmacao', mensagem, opcoes),
    advertir: (mensagem, opcoes) =>
      abrirDialogo('advertencia', mensagem, opcoes),
    negar: (mensagem, opcoes) => abrirDialogo('negacao', mensagem, opcoes),
  };
}
