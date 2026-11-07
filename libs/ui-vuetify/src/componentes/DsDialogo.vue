<script setup>
import { VDialog } from 'vuetify/components/VDialog';
import {
  VCard,
  VCardTitle,
  VCardText,
  VCardActions,
} from 'vuetify/components/VCard';

const aberto = defineModel({ type: Boolean, default: false });

defineProps({
  titulo: { type: String, default: '' },
  /** sm | md | lg */
  largura: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  /** Não fecha ao clicar fora ou apertar Esc. */
  persistente: Boolean,
});

const LARGURAS = { sm: 400, md: 600, lg: 900 };
</script>

<template>
  <VDialog
    v-model="aberto"
    :max-width="LARGURAS[largura]"
    :persistent="persistente"
  >
    <VCard class="ds-dialogo">
      <VCardTitle v-if="titulo" class="ds-dialogo__titulo">{{
        titulo
      }}</VCardTitle>
      <VCardText>
        <slot />
      </VCardText>
      <VCardActions v-if="$slots.acoes" class="ds-dialogo__acoes">
        <slot name="acoes" />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.ds-dialogo {
  background: var(--placa);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  box-shadow: var(--sombra-placa);
  font-family: var(--font-sans);
}
.ds-dialogo__titulo {
  padding: var(--esp-4) var(--esp-6) 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.ds-dialogo__acoes {
  justify-content: flex-end;
  gap: var(--esp-2);
  padding: var(--esp-2) var(--esp-6) var(--esp-4);
}
</style>
