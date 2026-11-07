<script setup>
import { computed } from 'vue';
import { VTextField } from 'vuetify/components/VTextField';

const modelo = defineModel({ type: [String, Number], default: '' });

const props = defineProps({
  rotulo: { type: String, default: '' },
  /** texto | email | senha | numero | telefone */
  tipo: {
    type: String,
    default: 'texto',
    validator: (v) =>
      ['texto', 'email', 'senha', 'numero', 'telefone'].includes(v),
  },
  dica: { type: String, default: '' },
  ajuda: { type: String, default: '' },
  /** Mensagem de erro vinda de fora (ex.: validação do servidor). */
  erro: { type: String, default: '' },
  /** Funções (valor) => true | 'mensagem de erro'. */
  regras: { type: Array, default: () => [] },
  obrigatorio: Boolean,
  desabilitado: Boolean,
  somenteLeitura: Boolean,
});

const TIPOS = {
  texto: 'text',
  email: 'email',
  senha: 'password',
  numero: 'number',
  telefone: 'tel',
};

const regrasFinais = computed(() => [
  ...(props.obrigatorio
    ? [
        (v) =>
          (v !== null && v !== undefined && String(v).trim() !== '') ||
          'Campo obrigatório',
      ]
    : []),
  ...props.regras,
]);
</script>

<template>
  <VTextField
    v-model="modelo"
    class="ds-input"
    variant="outlined"
    density="comfortable"
    :label="rotulo"
    :type="TIPOS[tipo]"
    :placeholder="dica || undefined"
    :hint="ajuda || undefined"
    :persistent-hint="!!ajuda"
    :error-messages="erro || undefined"
    :rules="regrasFinais"
    :disabled="desabilitado"
    :readonly="somenteLeitura"
  />
</template>

<style scoped>
.ds-input {
  font-family: var(--font-sans);
}
.ds-input :deep(.v-field) {
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.ds-input :deep(.v-field__outline) {
  color: var(--linha-forte);
  --v-field-border-opacity: 1;
}
</style>
