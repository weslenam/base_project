<script setup>
import { computed } from 'vue';
import { VBtn } from 'vuetify/components/VBtn';

const props = defineProps({
  /** primario | secundario | perigo | fantasma */
  variante: {
    type: String,
    default: 'primario',
    validator: (v) =>
      ['primario', 'secundario', 'perigo', 'fantasma'].includes(v),
  },
  /** sm | md | lg */
  tamanho: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  /** button | submit */
  tipo: {
    type: String,
    default: 'button',
    validator: (v) => ['button', 'submit'].includes(v),
  },
  desabilitado: Boolean,
  carregando: Boolean,
  bloco: Boolean,
});
const emit = defineEmits(['click']);

const VARIANTES = {
  primario: { color: 'primary', variant: 'flat' },
  secundario: { color: undefined, variant: 'outlined' },
  perigo: { color: 'error', variant: 'outlined' },
  fantasma: { color: 'primary', variant: 'text' },
};

const aparencia = computed(() => VARIANTES[props.variante]);
</script>

<template>
  <VBtn
    :class="['ds-botao', `ds-botao--${variante}`, `ds-botao--${tamanho}`]"
    :color="aparencia.color"
    :variant="aparencia.variant"
    :type="tipo"
    :block="bloco"
    :disabled="desabilitado || carregando"
    :loading="carregando"
    @click="emit('click', $event)"
  >
    <slot />
  </VBtn>
</template>

<style scoped>
/* Referência: .bt-botao em docs/identidade-visual/referencia-componentes.css */
.ds-botao {
  height: auto;
  min-height: 44px;
  padding: 0 var(--esp-4);
  border-radius: var(--raio-sm);
  font: var(--tipo-botao);
  letter-spacing: var(--tipo-botao-espacamento);
  text-transform: uppercase;
}
.ds-botao--sm {
  min-height: 32px;
  padding: 0 var(--esp-3);
  font-size: 13px;
}
.ds-botao--lg {
  min-height: 52px;
  padding: 0 var(--esp-6);
}
.ds-botao--primario:hover {
  background: var(--cobre-escuro);
}
.ds-botao--secundario {
  color: var(--grafite);
  border: 2px solid var(--linha-forte);
}
.ds-botao--secundario:hover {
  background: var(--placa-funda);
}
.ds-botao--perigo {
  border-width: 2px;
}
.ds-botao--fantasma {
  padding: 0 var(--esp-2);
}
</style>
