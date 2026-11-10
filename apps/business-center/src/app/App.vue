<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { DsApp, DsBotao, DsLayout } from '@barbertime/ui';
import Marca from './Marca.vue';
import { rotas } from '../router';
import { useOperador } from '../sessao/operador.ts';

// BarberTime Business Center (planejamento 0028, ADR 0018): equipe da plataforma.
const route = useRoute();
const router = useRouter();
const { operador, sair } = useOperador();

const itensMenu = rotas.flatMap((r) =>
  r.meta?.menu
    ? [{ titulo: r.meta.menu.titulo, rota: r.path, icone: r.meta.menu.icone }]
    : [],
);
const publica = computed(() => Boolean(route.meta.publica));

async function aoSair() {
  await sair();
  router.push('/entrar');
}
</script>

<template>
  <DsApp>
    <RouterView v-if="publica" />
    <DsLayout v-else titulo="Business Center" :itens-menu="itensMenu">
      <template #marca>
        <Marca />
      </template>
      <template v-if="operador" #cabecalho-acoes>
        <span class="operador">{{ operador.nome }}</span>
        <DsBotao variante="fantasma" tamanho="sm" @click="aoSair">Sair</DsBotao>
      </template>
      <RouterView />
    </DsLayout>
  </DsApp>
</template>

<style scoped>
.operador {
  margin-inline-end: var(--esp-2);
  font-weight: 600;
}
@media (max-width: 40rem) {
  .operador {
    display: none;
  }
}
</style>
