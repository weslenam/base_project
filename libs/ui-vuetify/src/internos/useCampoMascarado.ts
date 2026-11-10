import { nextTick, ref, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * Liga um VTextField a um modelo "limpo" (dígitos ou número), exibindo o texto formatado.
 * - formatar(modelo) → texto exibido
 * - extrair(texto) → novo valor do modelo
 */
export function useCampoMascarado<T>(
  modelo: Ref<T>,
  {
    formatar,
    extrair,
  }: { formatar: (valor: T) => string; extrair: (texto: string) => T },
) {
  const texto = ref(formatar(modelo.value));

  watch(modelo, (valor) => {
    texto.value = formatar(valor);
  });

  async function aoDigitar(digitado: string | null | undefined) {
    const valor = extrair(digitado ?? '');
    modelo.value = valor;
    // Reaplica a máscara mesmo quando o valor não muda (ex.: letra digitada e descartada).
    texto.value = digitado ?? '';
    await nextTick();
    texto.value = formatar(valor);
  }

  return { texto, aoDigitar };
}

/** Regra de validação: true quando válido, ou a mensagem de erro. */
export type Regra = (valor: unknown) => true | string;

/** Regra de obrigatório comum aos campos. */
export const regraObrigatorio: Regra = (v) =>
  (v !== null && v !== undefined && String(v).trim() !== '') ||
  'Campo obrigatório';
