import { computed } from 'vue';
import { useTheme } from 'vuetify';
import { temas } from '@barbertime/ui-tokens';
import type { ApiDeTema } from '@barbertime/ui-contrato';

/** Nome de um tema da identidade visual (ex.: claro, escuro). */
export type NomeDoTema = keyof typeof temas;

const NOMES = Object.keys(temas) as NomeDoTema[];
const eTema = (nome: string): nome is NomeDoTema =>
  (NOMES as string[]).includes(nome);

/**
 * Aplica o tema visual (efeito apenas). Escolher e lembrar o tema é uma
 * preferência: passa pela central de preferências do app (ADR 0006).
 */
export function useTema() {
  const tema = useTheme();

  function aplicar(nome: string): void {
    if (!eTema(nome)) {
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
  } satisfies ApiDeTema;
}
