<script setup>
/** Escolha única em botões grandes (estilo PDV). */
const modelo = defineModel({ type: [String, Number, null], default: null });

defineProps({
  /** [{ valor, rotulo }] */
  opcoes: { type: Array, required: true },
  /** Nome do grupo para leitor de tela. */
  rotulo: { type: String, required: true },
  desabilitado: Boolean,
});
</script>

<template>
  <div class="ds-escolha" role="group" :aria-label="rotulo">
    <button
      v-for="opcao in opcoes"
      :key="opcao.valor"
      type="button"
      class="ds-escolha__opcao"
      :aria-pressed="modelo === opcao.valor ? 'true' : 'false'"
      :disabled="desabilitado"
      @click="modelo = opcao.valor"
    >
      {{ opcao.rotulo }}
    </button>
  </div>
</template>

<style scoped>
.ds-escolha {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  gap: var(--esp-2);
}
.ds-escolha__opcao {
  min-height: 52px;
  padding: 0 var(--esp-3);
  border: 2px solid var(--linha-forte);
  border-radius: var(--raio-sm);
  background: var(--placa);
  color: var(--grafite);
  font: var(--tipo-botao);
  letter-spacing: var(--tipo-botao-espacamento);
  text-transform: uppercase;
  cursor: pointer;
}
.ds-escolha__opcao:hover:not(:disabled) {
  border-color: var(--cobre);
}
.ds-escolha__opcao[aria-pressed='true'] {
  border-color: var(--cobre);
  background: var(--cobre);
  color: var(--sobre-cobre);
}
.ds-escolha__opcao:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
