<script setup>
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { DsApp, DsLayout } from '@barbertime/ui';
import Marca from './Marca.vue';

const route = useRoute();
const publica = computed(() => Boolean(route.meta.publica));

const itensMenu = [
  { titulo: 'Agenda', rota: '/agenda', icone: 'agenda' },
  { titulo: 'Caixa', rota: '/caixa', icone: 'caixa' },
  { titulo: 'Clientes', rota: '/clientes', icone: 'clientes' },
  { titulo: 'Equipe', rota: '/equipe', icone: 'equipe' },
  { titulo: 'Serviços', rota: '/servicos', icone: 'servico' },
  { titulo: 'Produtos', rota: '/produtos', icone: 'produto' },
  {
    titulo: 'Página pública',
    rota: '/agendar/barbearia-modelo',
    icone: 'barbearia',
  },
  { titulo: 'Componentes', rota: '/componentes', icone: 'componentes' },
];
</script>

<template>
  <DsApp>
    <RouterView v-if="publica" />
    <DsLayout v-else titulo="BarberTime" :itens-menu="itensMenu">
      <template #marca>
        <Marca />
      </template>
      <RouterView />
    </DsLayout>
  </DsApp>
</template>
