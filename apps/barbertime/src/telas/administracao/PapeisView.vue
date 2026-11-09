<script setup>
import { computed, onMounted, ref } from 'vue';
import { DsCartao, DsPagina, DsSelo } from '@barbertime/ui';
import { historiaDoPapel, resumoDoPapel } from '@barbertime/dominio';
import { administracao } from '../../dados/administracao.js';
import { useAcao } from '../../dados/useAcao.js';
import { useSessao } from '../../sessao/sessao.js';
import HistoriaDoPapel from './HistoriaDoPapel.vue';

// Papéis contados como histórias (planejamento 0033): o que cada um faz no dia
// a dia e o que fica de fora, sem as chaves técnicas das permissões.
const executar = useAcao();
const { sessao } = useSessao();
const papeis = ref([]);

async function carregar() {
  const lista = await executar(() => administracao.papeis.listar());
  if (lista) papeis.value = lista;
}
onMounted(carregar);

const historias = computed(() =>
  papeis.value.map((p) => ({
    ...p,
    resumo: resumoDoPapel(p.chave),
    historia: historiaDoPapel(p.chave, sessao.value?.modulosAtivos ?? []),
  })),
);
</script>

<template>
  <DsPagina titulo="Papéis">
    <p class="ds-corpo-sm ds-suave">
      Cada pessoa tem um papel nesta barbearia. A hierarquia é fixa: Dono,
      Gerente, Recepção e Barbeiro. Cada um só convida, troca o papel ou remove
      quem está abaixo dele, e cada pessoa troca a própria senha em Meu perfil.
    </p>
    <div class="papeis">
      <DsCartao v-for="p in historias" :key="p.id" :titulo="p.nome">
        <template #cabecalho-acoes>
          <DsSelo estado="assinante">
            {{ p.usuarios }} {{ p.usuarios === 1 ? 'pessoa' : 'pessoas' }}
          </DsSelo>
        </template>
        <p class="resumo">{{ p.resumo }}</p>
        <HistoriaDoPapel v-if="p.historia" :historia="p.historia" />
      </DsCartao>
    </div>
  </DsPagina>
</template>

<style scoped>
.papeis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--esp-3);
}
.resumo {
  margin: 0 0 var(--esp-3);
  font: var(--tipo-corpo);
}
</style>
