<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsCartao, DsIcone, DsPagina, DsSelo } from '@barbertime/ui';
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

function abrir(papel = null) {
  selecionado.value = papel;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Papéis e permissões">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo papel
      </DsBotao>
    </template>
    <p class="ds-corpo-sm ds-suave">
      Cada usuário tem um papel nesta barbearia. Os papéis padrão podem ser
      ajustados (menos o Dono), e você pode criar os seus.
    </p>
    <div class="papeis">
      <DsCartao v-for="p in papeis" :key="p.id" :titulo="p.nome">
        <template #cabecalho-acoes>
          <DsSelo v-if="p.protegido" estado="assinante">Protegido</DsSelo>
        </template>
        <p class="ds-corpo-sm">
          {{ p.permissoes.length }} de
          {{ CHAVES_DE_PERMISSAO.length }} permissões · {{ p.usuarios }}
          {{ p.usuarios === 1 ? 'usuário' : 'usuários' }}
        </p>
        <template #acoes>
          <DsBotao variante="secundario" tamanho="sm" @click="abrir(p)">
            {{ p.protegido ? 'Ver permissões' : 'Editar' }}
          </DsBotao>
        </template>
      </DsCartao>
    </div>
    <PapelDialogo
      v-model="dialogoAberto"
      :papel="selecionado"
      @salvo="carregar"
    />
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
