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
  /**
   * sm: compacto (confirmações e formulários curtos)
   * md: compacto no desktop; quase tela cheia em tablet e celular (até 80rem)
   * lg | xl: quase tela cheia em qualquer tela
   */
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
</script>

<template>
  <VDialog
    v-model="aberto"
    :content-class="['ds-dialogo-caixa', `ds-dialogo-caixa--${largura}`]"
    :persistent="persistente"
  >
    <VCard class="ds-dialogo" :data-largura="largura">
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
      <VCardText class="ds-dialogo__corpo">
        <slot />
      </VCardText>
      <VCardActions v-if="$slots.acoes" class="ds-dialogo__acoes">
        <slot name="acoes" />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<!--
  Tamanho da caixa do diálogo (planejamento 0018). Sem "scoped": o Vuetify
  teleporta a caixa para o <body>. O "quase" da tela cheia é a margem em volta.
-->
<style>
.v-dialog > .v-overlay__content.ds-dialogo-caixa {
  --ds-dialogo-margem: clamp(12px, 2vw, 32px);
  margin: var(--ds-dialogo-margem);
  width: calc(100% - 2 * var(--ds-dialogo-margem));
  max-height: calc(100% - 2 * var(--ds-dialogo-margem));
}
.v-dialog > .v-overlay__content.ds-dialogo-caixa--sm {
  max-width: min(400px, calc(100% - 2 * var(--ds-dialogo-margem)));
}
.v-dialog > .v-overlay__content.ds-dialogo-caixa--md {
  max-width: min(600px, calc(100% - 2 * var(--ds-dialogo-margem)));
}
.v-dialog > .v-overlay__content.ds-dialogo-caixa--lg,
.v-dialog > .v-overlay__content.ds-dialogo-caixa--xl {
  max-width: calc(100% - 2 * var(--ds-dialogo-margem));
  height: calc(100% - 2 * var(--ds-dialogo-margem));
}
/* Tablet e celular: o médio também vira quase tela cheia. */
@media (max-width: 80rem) {
  .v-dialog > .v-overlay__content.ds-dialogo-caixa--md {
    max-width: calc(100% - 2 * var(--ds-dialogo-margem));
    height: calc(100% - 2 * var(--ds-dialogo-margem));
  }
}
/* Título e ações fixos; só o corpo rola, e só se não couber. */
.ds-dialogo-caixa > .ds-dialogo {
  display: flex;
  flex-direction: column;
  max-height: 100%;
}
.ds-dialogo-caixa--lg > .ds-dialogo,
.ds-dialogo-caixa--xl > .ds-dialogo {
  height: 100%;
}
@media (max-width: 80rem) {
  .ds-dialogo-caixa--md > .ds-dialogo {
    height: 100%;
  }
}
.ds-dialogo-caixa > .ds-dialogo > .ds-dialogo__corpo {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.ds-dialogo-caixa > .ds-dialogo > .ds-dialogo__topo,
.ds-dialogo-caixa > .ds-dialogo > .ds-dialogo__acoes {
  flex: 0 0 auto;
}
</style>

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
  border-top: 1px solid var(--linha);
  justify-content: flex-end;
  gap: var(--esp-2);
  padding: var(--esp-2) var(--esp-6) var(--esp-4);
}
</style>
