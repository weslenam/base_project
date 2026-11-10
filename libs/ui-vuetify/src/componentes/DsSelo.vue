<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import { ROTULOS_DE_ESTADO } from '../internos/estados.ts';
import type { EstadoVisual } from '../internos/estados.ts';

const props = defineProps({
  /** confirmado | pendente | assinante | fila | faltou | neutro */
  estado: {
    type: String as PropType<EstadoVisual>,
    default: 'neutro',
    validator: (v: string) =>
      [
        'confirmado',
        'pendente',
        'assinante',
        'fila',
        'faltou',
        'neutro',
      ].includes(v),
  },
});
const rotuloPadrao = computed(() => ROTULOS_DE_ESTADO[props.estado]);
</script>

<template>
  <span :class="['ds-selo', `ds-selo--${estado}`]">
    <slot>{{ rotuloPadrao }}</slot>
  </span>
</template>

<style scoped>
/* Referência: .bt-selo */
.ds-selo {
  display: inline-flex;
  align-items: center;
  gap: var(--esp-1);
  padding: 2px var(--esp-2);
  border-radius: var(--raio-pilula);
  font: var(--tipo-rotulo);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ds-selo::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: var(--raio-pilula);
  background: currentColor;
}
.ds-selo--confirmado {
  background: var(--sucesso-suave);
  color: var(--sucesso);
}
.ds-selo--pendente {
  background: var(--aco-suave);
  color: var(--aco);
}
.ds-selo--assinante {
  background: var(--cobre-suave);
  color: var(--cobre);
}
.ds-selo--fila {
  background: var(--ambar);
  color: var(--sobre-ambar);
}
.ds-selo--faltou {
  background: var(--perigo-suave);
  color: var(--perigo);
}
.ds-selo--neutro {
  background: var(--placa-funda);
  color: var(--grafite-suave);
}
</style>
