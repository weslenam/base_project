<script setup>
import { computed } from 'vue';
import { VIcon } from 'vuetify/components/VIcon';
import { ICONES, NOMES_DE_ICONES } from '../icones.js';

const props = defineProps({
  /** Nome do catálogo (ver NOMES_DE_ICONES). */
  nome: {
    type: String,
    required: true,
    validator: (v) => NOMES_DE_ICONES.includes(v),
  },
  /** sm (16px) | md (20px, interface) | lg (24px, navegação) */
  tamanho: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  /** Texto para leitor de tela. Sem rótulo, o ícone é decorativo. */
  rotulo: { type: String, default: '' },
});

const TAMANHOS = { sm: 16, md: 20, lg: 24 };
const caminho = computed(() => ICONES[props.nome]);
</script>

<template>
  <VIcon
    v-if="caminho"
    class="ds-icone"
    :icon="caminho"
    :size="TAMANHOS[tamanho]"
    :role="rotulo ? 'img' : undefined"
    :aria-label="rotulo || undefined"
    :aria-hidden="rotulo ? undefined : 'true'"
  />
</template>

<style scoped>
.ds-icone {
  color: currentColor;
}
</style>
