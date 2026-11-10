<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import type { OpcaoDeSelect } from '../tipos.ts';
import { VSelect } from 'vuetify/components/VSelect';

/** Valor de uma opção do DsSelect. */
type Valor = string | number | boolean;

const modelo = defineModel<Valor | Valor[] | null>({ default: null });

const props = defineProps({
  rotulo: { type: String, default: '' },
  /** [{ valor, rotulo }] */
  opcoes: {
    type: Array as PropType<OpcaoDeSelect[]>,
    default: () => [],
  },
  ajuda: { type: String, default: '' },
  erro: { type: String, default: '' },
  obrigatorio: Boolean,
  multiplo: Boolean,
  limpavel: Boolean,
  carregando: Boolean,
  desabilitado: Boolean,
});

const regras = computed(() =>
  props.obrigatorio
    ? [
        (v: unknown) =>
          (Array.isArray(v)
            ? v.length > 0
            : v !== null && v !== undefined && v !== '') || 'Campo obrigatório',
      ]
    : [],
);
</script>

<template>
  <VSelect
    v-model="modelo"
    class="ds-select"
    hide-details="auto"
    variant="outlined"
    density="comfortable"
    item-title="rotulo"
    item-value="valor"
    no-data-text="Nenhuma opção disponível"
    :items="opcoes"
    :label="rotulo"
    :hint="ajuda || undefined"
    :persistent-hint="!!ajuda"
    :error-messages="erro || undefined"
    :rules="regras"
    :multiple="multiplo"
    :chips="multiplo"
    :clearable="limpavel"
    :loading="carregando"
    :disabled="desabilitado"
  />
</template>

<style scoped>
.ds-select {
  font-family: var(--font-sans);
}
.ds-select :deep(.v-field) {
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.ds-select :deep(.v-field__outline) {
  color: var(--linha-forte);
  --v-field-border-opacity: 1;
}
</style>
