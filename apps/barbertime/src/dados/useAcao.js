import { useDialogo, useNotificacao } from '@barbertime/ui';
import { ErroDeNegocio } from './erros.js';

/**
 * Executa uma chamada à API mostrando a recusa de negócio no diálogo de negação.
 * Devolve o resultado, ou undefined se falhar.
 */
export function useAcao() {
  const { negar } = useDialogo();
  const notificar = useNotificacao();
  return async function executar(chamada) {
    try {
      return await chamada();
    } catch (erro) {
      if (erro instanceof ErroDeNegocio) await negar(erro.message);
      else {
        console.error(erro);
        notificar.erro('Algo deu errado. Tente de novo em instantes.');
      }
      return undefined;
    }
  };
}
