<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsTabela } from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import BarbeiroDialogo from './BarbeiroDialogo.vue';

const barbeiros = ref([]);
const dialogoAberto = ref(false);
const selecionadoId = ref(null);

const colunas = [
  { campo: 'nome', titulo: 'Barbeiro', ordenavel: true },
  {
    campo: 'inicio',
    titulo: 'Expediente',
    formatar: (v, b) => `${b.inicio}–${b.fim}`,
  },
  {
    campo: 'comissao',
    titulo: 'Comissão',
    alinhamento: 'fim',
    formatar: (v) => `${v}%`,
  },
];

async function carregar() {
  barbeiros.value = await api.barbeiros.listar();
}
onMounted(carregar);

function abrir(id = null) {
  selecionadoId.value = id;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Equipe" :sobretitulo="`${barbeiros.length} barbeiros`">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo barbeiro
      </DsBotao>
    </template>
    <DsTabela
      :colunas="colunas"
      :linhas="barbeiros"
      texto-vazio="Nenhum barbeiro cadastrado"
      @selecionar="(b) => abrir(b.id)"
    />
    <BarbeiroDialogo
      :id="selecionadoId"
      v-model="dialogoAberto"
      @salvo="carregar"
    />
  </DsPagina>
</template>
