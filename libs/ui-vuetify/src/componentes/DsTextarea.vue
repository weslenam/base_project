<script setup>
import { computed } from 'vue';
import { VTextarea } from 'vuetify/components/VTextarea';

const modelo = defineModel({ type: String, default: '' });

const props = defineProps({
  rotulo: { type: String, default: '' },
  dica: { type: String, default: '' },
  ajuda: { type: String, default: '' },
  erro: { type: String, default: '' },
  linhas: { type: Number, default: 3 },
  /** Mostra contador e limita o tamanho. */
  maxCaracteres: { type: Number, default: undefined },
  obrigatorio: Boolean,
  desabilitado: Boolean,
});

const regras = computed(() => [
  ...(props.obrigatorio
    ? [(v) => (v ?? '').trim() !== '' || 'Campo obrigatório']
    : []),
  ...(props.maxCaracteres
    ? [
        (v) =>
          (v ?? '').length <= props.maxCaracteres ||
          `Máximo de ${props.maxCaracteres} caracteres`,
      ]
    : []),
]);
</script>

<template>
  <VTextarea
    v-model="modelo"
    class="ds-textarea"
    variant="outlined"
    density="comfortable"
    auto-grow
    :rows="linhas"
    :label="rotulo"
    :placeholder="dica || undefined"
    :hint="ajuda || undefined"
    :persistent-hint="!!ajuda"
    :error-messages="erro || undefined"
    :counter="maxCaracteres"
    :rules="regras"
    :disabled="desabilitado"
  />
</template>

<style scoped>
.ds-textarea {
  font-family: var(--font-sans);
}
.ds-textarea :deep(.v-field) {
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.ds-textarea :deep(.v-field__outline) {
  color: var(--linha-forte);
  --v-field-border-opacity: 1;
}
</style>
