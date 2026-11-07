import { computed } from 'vue';
import { useTheme } from 'vuetify';
import { temas } from '@barbertime/ui-tokens';

const NOMES = Object.keys(temas);

/**
 * Aplica o tema visual (efeito apenas). Escolher e lembrar o tema é uma
 * preferência: passa pela central de preferências do app (ADR 0006).
 */
export function useTema() {
  const tema = useTheme();

  function aplicar(nome) {
    if (!NOMES.includes(nome)) {
      throw new Error(
        `Tema desconhecido: "${nome}". Válidos: ${NOMES.join(', ')}.`,
      );
    }
    tema.change(nome);
    // Os tokens CSS trocam de tema por [data-theme] (ADR 0003).
    document.documentElement.dataset.theme = temas[nome].id;
  }

  return {
    tema: computed(() => tema.global.name.value),
    temas: NOMES,
    aplicar,
  };
}
