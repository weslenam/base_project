<script setup>
import { computed, ref } from 'vue';
import { useDisplay } from 'vuetify';
import DsIcone from './DsIcone.vue';
import {
  VAppBar,
  VAppBarNavIcon,
  VAppBarTitle,
} from 'vuetify/components/VAppBar';
import { VDivider } from 'vuetify/components/VDivider';
import { VList, VListItem, VListSubheader } from 'vuetify/components/VList';
import { VBottomNavigation } from 'vuetify/components/VBottomNavigation';
import { VBtn } from 'vuetify/components/VBtn';
import { VMain } from 'vuetify/components/VMain';
import { VTab, VTabs } from 'vuetify/components/VTabs';
import { VNavigationDrawer } from 'vuetify/components/VNavigationDrawer';

const props = defineProps({
  titulo: { type: String, required: true },
  /**
   * [{ titulo, rota, icone?, grupo? }] (icone: nome do catálogo do DsIcone).
   * Itens seguidos com o mesmo grupo ficam sob um título com o nome dele,
   * com recuo; uma linha separa um grupo do outro.
   */
  itensMenu: { type: Array, default: () => [] },
  /** [{ titulo, icone? }]: ícone do título de cada grupo (pelo nome). */
  grupos: { type: Array, default: () => [] },
  /**
   * [{ titulo, rota, icone? }]: navegação por abas no lugar do menu lateral.
   * Dentro do cabeçalho, ao lado do título, no PC e no tablet; barra fixa no
   * rodapé no celular.
   */
  abas: { type: Array, default: () => [] },
});

// Celular: abas no rodapé, ao alcance do polegar.
const { xs: celular } = useDisplay();
// Altura do cabeçalho: as abas usam a mesma, para o sublinhado da aba ativa
// ficar na borda de baixo (#18).
const ALTURA_DO_CABECALHO = 64;

// Seções do menu: itens seguidos com o mesmo grupo (ou sem grupo) juntos.
const secoes = computed(() => {
  const lista = [];
  for (const item of props.itensMenu) {
    const titulo = item.grupo ?? null;
    const ultima = lista.at(-1);
    if (ultima && ultima.titulo === titulo) ultima.itens.push(item);
    else
      lista.push({
        titulo,
        icone: props.grupos.find((g) => g.titulo === titulo)?.icone ?? null,
        itens: [item],
      });
  }
  return lista;
});

// null = o Vuetify decide (aberto no desktop, fechado no celular).
const menuAberto = ref(null);
</script>

<template>
  <VAppBar
    class="ds-layout__cabecalho"
    flat
    border="b"
    :height="ALTURA_DO_CABECALHO"
  >
    <VAppBarNavIcon
      v-if="itensMenu.length"
      aria-label="Abrir menu"
      @click="menuAberto = !menuAberto"
    />
    <div class="ds-layout__marca">
      <slot name="marca" />
    </div>
    <VAppBarTitle
      :class="[
        'ds-layout__titulo',
        { 'ds-layout__titulo--com-abas': abas.length && !celular },
      ]"
      >{{ titulo }}</VAppBarTitle
    >
    <!-- PC e tablet: abas na mesma linha do título, sem faixa extra; a aba
         ativa fica sublinhada na borda do cabeçalho (planejamento 0036). -->
    <VTabs
      v-if="abas.length && !celular"
      class="ds-layout__abas"
      aria-label="Navegação principal"
      color="primary"
      :height="ALTURA_DO_CABECALHO"
      show-arrows
    >
      <VTab
        v-for="aba in abas"
        :key="aba.rota"
        :to="aba.rota"
        class="ds-layout__aba"
      >
        <DsIcone v-if="aba.icone" :nome="aba.icone" class="ds-layout__icone" />
        {{ aba.titulo }}
      </VTab>
    </VTabs>
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
      <template
        v-for="(secao, i) in secoes"
        :key="`${i}-${secao.titulo ?? ''}`"
      >
        <VDivider v-if="i > 0" class="ds-layout__divisoria" />
        <VListSubheader v-if="secao.titulo" class="ds-layout__grupo">
          <DsIcone
            v-if="secao.icone"
            :nome="secao.icone"
            tamanho="sm"
            class="ds-layout__icone-grupo"
          />
          {{ secao.titulo }}
        </VListSubheader>
        <VListItem
          v-for="item in secao.itens"
          :key="item.rota"
          :to="item.rota"
          :title="item.titulo"
          :class="{ 'ds-layout__filho': secao.titulo }"
          :data-ds-grupo="secao.titulo ?? undefined"
        >
          <template v-if="item.icone" #prepend>
            <DsIcone :nome="item.icone" class="ds-layout__icone" />
          </template>
        </VListItem>
      </template>
    </VList>
  </VNavigationDrawer>

  <VMain class="ds-layout__conteudo">
    <slot />
  </VMain>

  <VBottomNavigation
    v-if="abas.length && celular"
    class="ds-layout__rodape"
    aria-label="Navegação principal"
    color="primary"
    grow
  >
    <VBtn v-for="aba in abas" :key="aba.rota" :to="aba.rota">
      <DsIcone v-if="aba.icone" :nome="aba.icone" />
      <span>{{ aba.titulo }}</span>
    </VBtn>
  </VBottomNavigation>
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
.ds-layout__divisoria {
  margin-block: var(--esp-2);
  border-color: var(--linha) !important;
  opacity: 1;
}
.ds-layout__grupo {
  padding-inline-start: var(--esp-2) !important;
  display: flex;
  align-items: center;
  gap: var(--esp-2);
  font: var(--tipo-rotulo);
  letter-spacing: var(--tipo-rotulo-espacamento);
  text-transform: uppercase;
  color: var(--grafite-suave);
}
.ds-layout__icone-grupo {
  color: var(--grafite-suave);
}
.ds-layout__filho {
  /* Título em --esp-2; filhos com --esp-4 a mais de recuo. */
  padding-inline-start: var(--esp-6) !important;
}
.ds-layout__icone {
  color: inherit;
}
/* Espaço entre ícone e texto: o padrão do Vuetify (32px) afasta demais. */
.ds-layout__menu :deep(.v-list-item__spacer) {
  inline-size: var(--esp-3) !important;
}
.ds-layout__conteudo {
  font-family: var(--font-sans);
}
.ds-layout__titulo--com-abas {
  /* Com abas, o título não empurra as abas para a direita e é ele quem
     encolhe (com reticências) quando falta espaço: as abas ficam sempre
     inteiras (#18). */
  flex: 0 1 auto;
  min-width: 0;
  margin-inline-end: var(--esp-6);
}
.ds-layout__abas {
  flex: 0 0 auto;
  max-width: 60%;
}
.ds-layout__rodape {
  background: var(--placa) !important;
  border-top: 1px solid var(--linha);
}
.ds-layout__aba {
  gap: var(--esp-2);
  font: var(--tipo-botao);
  letter-spacing: var(--tipo-botao-espacamento);
}
.ds-layout__rodape :deep(.v-btn) {
  font: var(--tipo-rotulo);
  letter-spacing: var(--tipo-rotulo-espacamento);
}
</style>
