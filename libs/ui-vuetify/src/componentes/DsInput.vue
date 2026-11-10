<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import type { Regra } from '../internos/useCampoMascarado.ts';
import { VTextField } from 'vuetify/components/VTextField';

const modelo = defineModel<string | number | null>({ default: '' });

type TipoDeInput =
  | 'texto'
  | 'email'
  | 'senha'
  | 'numero'
  | 'telefone'
  | 'data'
  | 'hora';

const props = defineProps({
  rotulo: { type: String, default: '' },
  /** texto | email | senha | numero | telefone | data | hora */
  tipo: {
    type: String as PropType<TipoDeInput>,
    default: 'texto',
    validator: (v: string) =>
      [
        'texto',
        'email',
        'senha',
        'numero',
        'telefone',
        'data',
        'hora',
      ].includes(v),
  },
  dica: { type: String, default: '' },
  ajuda: { type: String, default: '' },
  /** Mensagem de erro vinda de fora (ex.: validação do servidor). */
  erro: { type: String, default: '' },
  /** Funções (valor) => true | 'mensagem de erro'. */
  regras: { type: Array as PropType<Regra[]>, default: () => [] },
  obrigatorio: Boolean,
  desabilitado: Boolean,
  somenteLeitura: Boolean,
});

const TIPOS: Record<TipoDeInput, string> = {
  texto: 'text',
  email: 'email',
  senha: 'password',
  numero: 'number',
  telefone: 'tel',
  data: 'date',
  hora: 'time',
};

const regrasFinais = computed(() => [
  ...(props.obrigatorio
    ? [
        (v: unknown) =>
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
    hide-details="auto"
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
