<script setup>
import { computed } from 'vue';
import { VApp } from 'vuetify/components/VApp';
import { VSnackbarQueue } from 'vuetify/components/VSnackbarQueue';
import DsBotao from './DsBotao.vue';
import DsDialogo from './DsDialogo.vue';
import { filaNotificacoes } from '../estado/notificacoes.js';
import {
  filaConfirmacoes,
  responderConfirmacao,
} from '../estado/confirmacoes.js';

// Raiz obrigatória dos apps: aplica o tema e hospeda notificações e confirmações.
const confirmacao = computed(() => filaConfirmacoes.value[0] ?? null);
const confirmacaoAberta = computed({
  get: () => confirmacao.value !== null,
  set: (aberto) => {
    if (!aberto) responderConfirmacao(false);
  },
});
</script>

<template>
  <VApp class="ds-app">
    <slot />

    <VSnackbarQueue
      v-model="filaNotificacoes"
      location="top right"
      closable
      close-text="Fechar"
    />

    <DsDialogo
      v-model="confirmacaoAberta"
      :titulo="confirmacao?.titulo"
      largura="sm"
      persistente
    >
      {{ confirmacao?.mensagem }}
      <template #acoes>
        <DsBotao variante="secundario" @click="responderConfirmacao(false)">
          {{ confirmacao?.textoCancelar }}
        </DsBotao>
        <DsBotao
          :variante="confirmacao?.perigo ? 'perigo' : 'primario'"
          @click="responderConfirmacao(true)"
        >
          {{ confirmacao?.textoOk }}
        </DsBotao>
      </template>
    </DsDialogo>
  </VApp>
</template>

<style scoped>
.ds-app {
  background: var(--concreto);
  color: var(--grafite);
  font-family: var(--font-sans);
}
</style>
