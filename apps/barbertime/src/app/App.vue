<script setup>
import { RouterView } from 'vue-router';
import { DsApp, DsLayout } from '@barbertime/ui';
import Marca from './Marca.vue';

const itensMenu = [
  { titulo: 'Início', rota: '/', icone: 'inicio' },
  { titulo: 'Componentes', rota: '/componentes', icone: 'componentes' },
];
</script>

<template>
  <DsApp>
    <DsLayout titulo="BarberTime" :itens-menu="itensMenu">
      <template #marca>
        <Marca />
      </template>
      <RouterView />
    </DsLayout>
  </DsApp>
</template>
