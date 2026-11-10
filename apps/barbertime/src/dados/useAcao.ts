import { useDialogo, useNotificacao } from '@barbertime/ui';
import { useRouter } from 'vue-router';
import { ErroDeNegocio } from './erros.ts';
import { ErroDeSessao } from './http.ts';
import { definirSessao } from '../sessao/sessao.ts';

/**
 * Executa uma chamada à API mostrando a recusa de negócio no diálogo de negação.
 * Devolve o resultado, ou undefined se falhar.
 */
export function useAcao() {
  const { negar } = useDialogo();
  const notificar = useNotificacao();
  const router = useRouter();
  return async function executar<T>(
    chamada: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await chamada();
    } catch (erro) {
      if (erro instanceof ErroDeSessao) {
        definirSessao(null);
        notificar.aviso('Sua sessão terminou. Entre de novo.');
        router.push({
          path: '/entrar',
          query: { volta: router.currentRoute.value.fullPath },
        });
      } else if (erro instanceof ErroDeNegocio) await negar(erro.message);
      else {
        console.error(erro);
        notificar.erro('Algo deu errado. Tente de novo em instantes.');
      }
      return undefined;
    }
  };
}
