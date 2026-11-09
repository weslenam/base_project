import { nextTick, ref, watch } from 'vue';

/**
 * Liga um VTextField a um modelo "limpo" (dígitos ou número), exibindo o texto formatado.
 * - formatar(modelo) → texto exibido
 * - extrair(texto) → novo valor do modelo
 */
export function useCampoMascarado(modelo, { formatar, extrair }) {
  const texto = ref(formatar(modelo.value));

  watch(modelo, (valor) => {
    texto.value = formatar(valor);
  });

  async function aoDigitar(digitado) {
    const valor = extrair(digitado ?? '');
    modelo.value = valor;
    // Reaplica a máscara mesmo quando o valor não muda (ex.: letra digitada e descartada).
    texto.value = digitado;
    await nextTick();
    texto.value = formatar(valor);
  }

  return { texto, aoDigitar };
}

/** Regra de obrigatório comum aos campos. */
export const regraObrigatorio = (v) =>
  (v !== null && v !== undefined && String(v).trim() !== '') ||
  'Campo obrigatório';
