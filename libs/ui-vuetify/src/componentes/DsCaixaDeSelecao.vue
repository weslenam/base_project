<script setup lang="ts">
import { useId } from 'vue';

const marcado = defineModel({ type: Boolean, default: false });
defineProps({
  rotulo: { type: String, required: true },
  /** Linha de apoio abaixo do rótulo. */
  descricao: { type: String, default: '' },
  desabilitado: Boolean,
});
const id = useId();
</script>

<template>
  <label
    :for="id"
    :class="['ds-caixa', { 'ds-caixa--desabilitada': desabilitado }]"
  >
    <input
      :id="id"
      v-model="marcado"
      type="checkbox"
      class="ds-caixa__entrada"
      :disabled="desabilitado"
    />
    <span class="ds-caixa__marca" aria-hidden="true" />
    <span class="ds-caixa__textos">
      <span class="ds-caixa__rotulo">{{ rotulo }}</span>
      <span v-if="descricao" class="ds-caixa__descricao">{{ descricao }}</span>
    </span>
  </label>
</template>

<style scoped>
.ds-caixa {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--esp-3);
  min-height: 44px;
  padding: var(--esp-2) 0;
  cursor: pointer;
}
.ds-caixa--desabilitada {
  cursor: not-allowed;
  opacity: 0.6;
}
.ds-caixa__entrada {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.ds-caixa__marca {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border: 2px solid var(--linha-forte);
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.ds-caixa__entrada:checked + .ds-caixa__marca {
  border-color: var(--cobre);
  background: var(--cobre)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E")
    center / 16px no-repeat;
}
.ds-caixa__entrada:focus-visible + .ds-caixa__marca {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
}
.ds-caixa__textos {
  display: grid;
  gap: 2px;
}
.ds-caixa__rotulo {
  font: var(--tipo-corpo);
}
.ds-caixa__descricao {
  font: var(--tipo-corpo-sm);
  color: var(--grafite-suave);
}
</style>
