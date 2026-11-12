<script setup lang="ts">
import { VTextField } from 'vuetify/components/VTextField';

/** Modelo: string no formato YYYY-MM-DD (padrão do input[type=date]). */
const modelo = defineModel<string>({ default: '' });

defineProps({
  rotulo: { type: String, default: 'Data' },
  min: { type: String, default: '' },
  max: { type: String, default: '' },
  obrigatorio: Boolean,
  desabilitado: Boolean,
});
</script>

<template>
  <VTextField
    v-model="modelo"
    class="ds-input-data"
    type="date"
    hide-details="auto"
    variant="outlined"
    density="comfortable"
    :label="rotulo"
    :min="min || undefined"
    :max="max || undefined"
    :required="obrigatorio"
    :disabled="desabilitado"
  />
</template>

<style scoped>
.ds-input-data {
  font-family: var(--font-sans);
}
.ds-input-data :deep(.v-field) {
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.ds-input-data :deep(.v-field__outline) {
  color: var(--linha-forte);
  --v-field-border-opacity: 1;
}
</style>
