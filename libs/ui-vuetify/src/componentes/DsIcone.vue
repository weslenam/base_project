<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import { VIcon } from 'vuetify/components/VIcon';
import { ICONES, NOMES_DE_ICONES } from '../icones.ts';
import type { NomeDoIcone } from '../icones.ts';

const props = defineProps({
  /** Nome do catálogo (ver NOMES_DE_ICONES). */
  nome: {
    type: String as PropType<NomeDoIcone>,
    required: true,
    validator: (v: string) =>
      (NOMES_DE_ICONES as readonly string[]).includes(v),
  },
  /** sm (16px) | md (20px, interface) | lg (24px, navegação) */
  tamanho: {
    type: String as PropType<'sm' | 'md' | 'lg'>,
    default: 'md',
    validator: (v: string) => ['sm', 'md', 'lg'].includes(v),
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
