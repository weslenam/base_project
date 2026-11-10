<script setup lang="ts">
import { computed, onUnmounted } from 'vue';
import { VApp } from 'vuetify/components/VApp';
import { VSnackbarQueue } from 'vuetify/components/VSnackbarQueue';
import DsBotao from './DsBotao.vue';
import DsDialogo from './DsDialogo.vue';
import DsIcone from './DsIcone.vue';
import { filaNotificacoes } from '../estado/notificacoes.ts';
import {
  descartarDialogos,
  filaDialogos,
  responderDialogo,
} from '../estado/dialogos.ts';

// Raiz obrigatória dos apps: aplica o tema e hospeda notificações e diálogos.
const dialogo = computed(() => filaDialogos.value[0] ?? null);
const dialogoAberto = computed({
  get: () => dialogo.value !== null,
  set: (aberto) => {
    if (!aberto) responderDialogo(false);
  },
});
// Saiu da tela: nada fica pendurado esperando resposta.
onUnmounted(() => {
  descartarDialogos();
  filaNotificacoes.value = [];
});

const tom = computed(() =>
  dialogo.value?.perigo ? 'perigo' : (dialogo.value?.tipo ?? 'confirmacao'),
);
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
      v-model="dialogoAberto"
      :titulo="dialogo?.titulo"
      largura="sm"
      :persistente="dialogo?.tipo !== 'negacao'"
    >
      <div
        v-if="dialogo"
        :class="['ds-alerta', `ds-alerta--${tom}`]"
        :data-tipo="dialogo.tipo"
      >
        <span class="ds-alerta__icone">
          <DsIcone :nome="dialogo.icone" tamanho="lg" />
        </span>
        <p class="ds-alerta__mensagem">{{ dialogo.mensagem }}</p>
      </div>
      <template #acoes>
        <DsBotao
          v-if="dialogo?.textoCancelar"
          variante="secundario"
          @click="responderDialogo(false)"
        >
          {{ dialogo.textoCancelar }}
        </DsBotao>
        <DsBotao
          :variante="dialogo?.perigo ? 'perigo' : 'primario'"
          @click="responderDialogo(true)"
        >
          {{ dialogo?.textoOk }}
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
.ds-alerta {
  display: flex;
  align-items: flex-start;
  gap: var(--esp-3);
}
.ds-alerta__icone {
  display: inline-flex;
  flex-shrink: 0;
  padding: var(--esp-2);
  border-radius: var(--raio-sm);
}
.ds-alerta__mensagem {
  margin: 0;
  padding-top: var(--esp-2);
  font: var(--tipo-corpo);
}
.ds-alerta--confirmacao .ds-alerta__icone {
  background: var(--aco-suave);
  color: var(--aco);
}
.ds-alerta--advertencia .ds-alerta__icone {
  background: var(--cobre-suave);
  color: var(--cobre);
}
.ds-alerta--negacao .ds-alerta__icone,
.ds-alerta--perigo .ds-alerta__icone {
  background: var(--perigo-suave);
  color: var(--perigo);
}
</style>
