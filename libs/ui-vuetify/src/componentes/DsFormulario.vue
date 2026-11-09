<script setup>
import { ref } from 'vue';
import { VForm } from 'vuetify/components/VForm';

defineProps({
  /** id do <form>: permite um DsBotao fora dele (ex.: nas ações do diálogo) com `formulario="id"`. */
  id: { type: String, default: undefined },
});
const emit = defineEmits(['enviar', 'invalido']);
const formulario = ref(null);

/** Valida todos os campos e só emite `enviar` quando tudo está válido. */
async function aoEnviar() {
  const { valid } = await formulario.value.validate();
  emit(valid ? 'enviar' : 'invalido');
}

defineExpose({
  validar: async () => (await formulario.value.validate()).valid,
  limpar: () => formulario.value.resetValidation(),
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
