<script setup lang="ts">
import { ref } from 'vue';
import { VForm } from 'vuetify/components/VForm';

defineProps({
  /** id do <form>: permite um DsBotao fora dele (ex.: nas ações do diálogo) com `formulario="id"`. */
  id: { type: String, default: undefined },
});
const emit = defineEmits<{ enviar: []; invalido: [] }>();
const formulario = ref<InstanceType<typeof VForm> | null>(null);

/** O VForm montado; fora da tela é erro de uso, não um envio silencioso. */
function vForm() {
  if (!formulario.value) throw new Error('DsFormulario não está montado.');
  return formulario.value;
}

/** Valida todos os campos e só emite `enviar` quando tudo está válido. */
async function aoEnviar() {
  const { valid } = await vForm().validate();
  if (valid) emit('enviar');
  else emit('invalido');
}

defineExpose({
  validar: async () => (await vForm().validate()).valid,
  limpar: () => vForm().resetValidation(),
});
</script>

<template>
  <VForm
    :id="id"
    ref="formulario"
    class="ds-formulario"
    @submit.prevent="aoEnviar"
  >
    <slot />
  </VForm>
</template>

<style scoped>
.ds-formulario {
  display: grid;
  /* Coluna que encolhe: abas e campos largos não alargam a página (ADR 0020). */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--esp-3);
}
</style>
