<script setup lang="ts">
import type { PropType } from 'vue';
import type { OpcaoDeEscolha } from '../tipos.ts';

/** Escolha única em botões grandes (estilo PDV). */
const modelo = defineModel<OpcaoDeEscolha['valor']>({ default: null });

defineProps({
  /**
   * [{ valor, rotulo, detalhe?, desabilitado? }]. detalhe: segunda linha
   * (ex.: "30 min · R$ 45,00", "~15 min"); desabilitado: só aquela opção.
   */
  opcoes: {
    type: Array as PropType<readonly OpcaoDeEscolha[]>,
    required: true,
  },
  /** Botões maiores, em grade, para escolhas com detalhe (ex.: balcão). */
  grande: Boolean,
  /** Nome do grupo para leitor de tela. */
  rotulo: { type: String, required: true },
  desabilitado: Boolean,
});
</script>

<template>
  <div
    :class="['ds-escolha', { 'ds-escolha--grande': grande }]"
    role="group"
    :aria-label="rotulo"
  >
    <button
      v-for="opcao in opcoes"
      :key="`${typeof opcao.valor}:${String(opcao.valor)}`"
      type="button"
      class="ds-escolha__opcao"
      :aria-pressed="modelo === opcao.valor ? 'true' : 'false'"
      :disabled="desabilitado || opcao.desabilitado"
      @click="modelo = opcao.valor"
    >
      <span class="ds-escolha__rotulo">{{ opcao.rotulo }}</span>
      <span v-if="opcao.detalhe" class="ds-escolha__detalhe">{{
        opcao.detalhe
      }}</span>
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
.ds-escolha__rotulo,
.ds-escolha__detalhe {
  display: block;
}
.ds-escolha__detalhe {
  margin-top: 2px;
  font: var(--tipo-corpo-sm);
  letter-spacing: normal;
  text-transform: none;
  opacity: 0.85;
}
.ds-escolha--grande {
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
}
.ds-escolha--grande .ds-escolha__opcao {
  min-height: 72px;
  padding: var(--esp-2) var(--esp-3);
  text-align: left;
}
.ds-escolha__opcao:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
