<script setup>
import { ref } from 'vue';
import DsIcone from './DsIcone.vue';
import {
  VAppBar,
  VAppBarNavIcon,
  VAppBarTitle,
} from 'vuetify/components/VAppBar';
import { VList, VListItem } from 'vuetify/components/VList';
import { VMain } from 'vuetify/components/VMain';
import { VNavigationDrawer } from 'vuetify/components/VNavigationDrawer';

defineProps({
  titulo: { type: String, required: true },
  /** [{ titulo, rota, icone? }] (icone: nome do catálogo do DsIcone) */
  itensMenu: { type: Array, default: () => [] },
});

// null = o Vuetify decide (aberto no desktop, fechado no celular).
const menuAberto = ref(null);
</script>

<template>
  <VAppBar class="ds-layout__cabecalho" flat border="b">
    <VAppBarNavIcon
      v-if="itensMenu.length"
      aria-label="Abrir menu"
      @click="menuAberto = !menuAberto"
    />
    <div class="ds-layout__marca">
      <slot name="marca" />
    </div>
    <VAppBarTitle class="ds-layout__titulo">{{ titulo }}</VAppBarTitle>
    <template #append>
      <slot name="cabecalho-acoes" />
    </template>
  </VAppBar>

  <VNavigationDrawer
    v-if="itensMenu.length"
    v-model="menuAberto"
    class="ds-layout__menu"
  >
    <VList nav aria-label="Menu principal">
      <VListItem
        v-for="item in itensMenu"
        :key="item.rota"
        :to="item.rota"
        :title="item.titulo"
      />
    </VList>
  </VNavigationDrawer>

  <VMain class="ds-layout__conteudo">
    <slot />
  </VMain>
</template>

<style scoped>
.ds-layout__cabecalho {
  background: var(--placa) !important;
  border-color: var(--linha) !important;
  color: var(--grafite);
}
.ds-layout__marca {
  display: flex;
  align-items: center;
  margin-inline-start: var(--esp-4);
}
.ds-layout__marca:empty {
  display: none;
}
.ds-layout__titulo {
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.ds-layout__menu {
  background: var(--placa) !important;
  border-color: var(--linha) !important;
}
.ds-layout__menu :deep(.v-list-item--active) {
  background: var(--cobre-suave);
  color: var(--cobre);
}
.ds-layout__icone {
  margin-inline-end: var(--esp-3);
}
.ds-layout__conteudo {
  font-family: var(--font-sans);
}
</style>
