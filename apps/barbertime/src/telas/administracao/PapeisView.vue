<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsCartao, DsPagina, DsSelo } from '@barbertime/ui';
import { CHAVES_DE_PERMISSAO } from '@barbertime/dominio';
import { administracao } from '../../dados/administracao.js';
import { useAcao } from '../../dados/useAcao.js';
import PapelDialogo from './PapelDialogo.vue';

const executar = useAcao();
const papeis = ref([]);
const dialogoAberto = ref(false);
const selecionado = ref(null);

async function carregar() {
  const lista = await executar(() => administracao.papeis.listar());
  if (lista) papeis.value = lista;
}
onMounted(carregar);

function abrir(papel) {
  selecionado.value = papel;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Papéis e permissões">
    <p class="ds-corpo-sm ds-suave">
      Cada usuário tem um papel nesta barbearia. A hierarquia é fixa: Dono,
      Gerente, Recepção e Barbeiro. Cada um só convida, troca o papel ou remove
      quem está abaixo dele, e cada pessoa troca a própria senha em Meu perfil.
    </p>
    <div class="papeis">
      <DsCartao v-for="p in papeis" :key="p.id" :titulo="p.nome">
        <template #cabecalho-acoes>
          <DsSelo estado="assinante">Nível {{ p.nivel }}</DsSelo>
        </template>
        <p class="ds-corpo-sm">
          {{ p.permissoes.length }} de
          {{ CHAVES_DE_PERMISSAO.length }} permissões · {{ p.usuarios }}
          {{ p.usuarios === 1 ? 'usuário' : 'usuários' }}
        </p>
        <template #acoes>
          <DsBotao variante="secundario" tamanho="sm" @click="abrir(p)">
            Ver permissões
          </DsBotao>
        </template>
      </DsCartao>
    </div>
    <PapelDialogo v-model="dialogoAberto" :papel="selecionado" />
  </DsPagina>
</template>

<style scoped>
.papeis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--esp-3);
}
.papeis p {
  margin: 0;
}
</style>
