import { pedirConfirmacao } from '../estado/confirmacoes.js';

/**
 * Diálogo de confirmação que devolve Promise<boolean>.
 * Uso: const confirmar = useConfirmacao(); if (await confirmar('Excluir?')) ...
 * Opções: { titulo, textoOk, textoCancelar, perigo }. Exige um <DsApp> na raiz.
 */
export function useConfirmacao() {
  return pedirConfirmacao;
}
