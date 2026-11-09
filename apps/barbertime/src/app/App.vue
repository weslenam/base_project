<script setup>
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { DsApp, DsBotao, DsLayout } from '@barbertime/ui';
import Marca from './Marca.vue';
import { rotas, rotaPermitida } from '../router';
import { useSessao } from '../sessao/sessao.js';

const route = useRoute();
const router = useRouter();
const { sessao, sair } = useSessao();

const semMenu = computed(() =>
  Boolean(route.meta.publica || route.meta.semLayout),
);

// Ícone do título de cada grupo do menu (planejamento 0030).
const gruposMenu = [
  { titulo: 'Operação', icone: 'fila' },
  { titulo: 'Cadastros', icone: 'componentes' },
  { titulo: 'Estoque', icone: 'estoque' },
  { titulo: 'Administração', icone: 'configuracoes' },
];

// Menu montado das rotas: só o que o papel permite e o módulo libera.
// O link da página pública fica em Configurações > Página pública (planejamento
// 0019): no modo "só com o link" ele exige o código, que a sessão não conhece.
const itensMenu = computed(() => {
  if (!sessao.value) return [];
  return rotas
    .filter((r) => r.meta?.menu && rotaPermitida(r.meta))
    .map((r) => ({
      titulo: r.meta.menu.titulo,
      rota: r.path,
      icone: r.meta.menu.icone,
      grupo: r.meta.menu.grupo,
    }));
});

async function aoSair() {
  await sair();
  router.push('/entrar');
}
</script>

<template>
  <DsApp>
    <RouterView v-if="semMenu" />
    <DsLayout
      v-else
      :titulo="sessao?.barbearia?.nome ?? 'BarberTime'"
      :itens-menu="itensMenu"
      :grupos="gruposMenu"
    >
      <template #marca>
        <Marca />
      </template>
      <template v-if="sessao?.usuario" #cabecalho-acoes>
        <RouterLink to="/perfil" class="usuario" title="Meu perfil">
          <span class="usuario__nome">{{ sessao.usuario.nome }}</span>
          <span class="usuario__papel">{{ sessao.papel?.nome }}</span>
        </RouterLink>
        <DsBotao variante="fantasma" tamanho="sm" @click="aoSair">Sair</DsBotao>
      </template>
      <RouterView />
    </DsLayout>
  </DsApp>
</template>

<style scoped>
.usuario {
  display: grid;
  margin-inline-end: var(--esp-2);
  padding: var(--esp-1) var(--esp-2);
  border-radius: var(--raio-sm);
  text-align: right;
  line-height: 1.2;
  color: inherit;
  text-decoration: none;
}
.usuario:hover,
.usuario:focus-visible {
  background: var(--cobre-suave);
}
.usuario__nome {
  font-weight: 600;
}
.usuario__papel {
  font: var(--tipo-corpo-sm);
  color: var(--grafite-suave);
}
@media (max-width: 40rem) {
  .usuario {
    display: none;
  }
}
</style>
