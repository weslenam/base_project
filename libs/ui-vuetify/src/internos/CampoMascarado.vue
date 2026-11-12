<script setup lang="ts">
// Base interna dos campos com máscara (telefone, CPF, moeda). Não é exportada.
import { computed } from 'vue';
import type { PropType } from 'vue';
import { VTextField } from 'vuetify/components/VTextField';
import { regraObrigatorio, useCampoMascarado } from './useCampoMascarado.ts';

/** Valor limpo do campo: dígitos (telefone, CPF) ou número (moeda). */
type Valor = string | number | null;

const modelo = defineModel<Valor>({ default: null });

const props = defineProps({
  formatar: {
    type: Function as PropType<(valor: Valor) => string>,
    required: true,
  },
  extrair: {
    type: Function as PropType<(texto: string) => Valor>,
    required: true,
  },
  /** (valorDoModelo) => boolean, aplicado só quando há valor. */
  validar: {
    type: Function as PropType<((valor: Valor) => boolean) | null>,
    default: null,
  },
  mensagemInvalida: { type: String, default: 'Valor inválido' },
  rotulo: { type: String, default: '' },
  dica: { type: String, default: '' },
  ajuda: { type: String, default: '' },
  erro: { type: String, default: '' },
  prefixo: { type: String, default: '' },
  modoTeclado: { type: String, default: 'numeric' },
  obrigatorio: Boolean,
  desabilitado: Boolean,
  limpavel: Boolean,
});

const { texto, aoDigitar } = useCampoMascarado(modelo, props);

const regras = computed(() => [
  ...(props.obrigatorio ? [() => regraObrigatorio(modelo.value)] : []),
  ...(props.validar
    ? [
        () =>
          modelo.value === null ||
          modelo.value === '' ||
          props.validar?.(modelo.value) ||
          props.mensagemInvalida,
      ]
    : []),
]);
</script>

<template>
  <VTextField
    class="ds-campo-mascarado"
    hide-details="auto"
    variant="outlined"
    density="comfortable"
    :model-value="texto"
    :label="rotulo"
    :placeholder="dica || undefined"
    :hint="ajuda || undefined"
    :persistent-hint="!!ajuda"
    :error-messages="erro || undefined"
    :prefix="prefixo || undefined"
    :rules="regras"
    :disabled="desabilitado"
    :clearable="limpavel"
    :inputmode="modoTeclado"
    @update:model-value="aoDigitar"
  />
</template>

<style scoped>
.ds-campo-mascarado {
  font-family: var(--font-sans);
}
.ds-campo-mascarado :deep(.v-field) {
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.ds-campo-mascarado :deep(.v-field__outline) {
  color: var(--linha-forte);
  --v-field-border-opacity: 1;
}
.ds-campo-mascarado :deep(input) {
  font-variant-numeric: tabular-nums;
}
</style>
