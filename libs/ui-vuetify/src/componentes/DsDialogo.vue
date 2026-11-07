<script setup>
import { VDialog } from 'vuetify/components/VDialog';
import DsIcone from './DsIcone.vue';
import {
  VCard,
  VCardTitle,
  VCardText,
  VCardActions,
} from 'vuetify/components/VCard';

const aberto = defineModel({ type: Boolean, default: false });

defineProps({
  titulo: { type: String, default: '' },
  /** sm | md | lg | xl */
  largura: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'xl'].includes(v),
  },
  /** Mostra um "X" (Fechar) no título; dispensa rodapé só para fechar. */
  fechavel: Boolean,
  /** Não fecha ao clicar fora ou apertar Esc. */
  persistente: Boolean,
});

const LARGURAS = { sm: 400, md: 600, lg: 900, xl: 1200 };
</script>

<template>
  <VDialog
    v-model="aberto"
    :max-width="LARGURAS[largura]"
    :persistent="persistente"
  >
    <VCard class="ds-dialogo">
      <div v-if="titulo || fechavel" class="ds-dialogo__topo">
        <VCardTitle v-if="titulo" class="ds-dialogo__titulo">{{
          titulo
        }}</VCardTitle>
        <button
          v-if="fechavel"
          type="button"
          class="ds-dialogo__fechar"
          aria-label="Fechar"
          @click="aberto = false"
        >
          <DsIcone nome="fechar" tamanho="lg" />
        </button>
      </div>
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
.ds-dialogo__topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--esp-2);
}
.ds-dialogo__fechar {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin: var(--esp-2) var(--esp-2) 0 0;
  border: 0;
  border-radius: var(--raio-sm);
  background: transparent;
  color: var(--grafite-suave);
  cursor: pointer;
}
.ds-dialogo__fechar:hover {
  background: var(--placa-funda);
  color: var(--grafite);
}
.ds-dialogo__titulo {
  padding: var(--esp-4) var(--esp-6) 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.ds-dialogo__acoes {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--esp-2);
  padding: var(--esp-2) var(--esp-6) var(--esp-4);
}
</style>
