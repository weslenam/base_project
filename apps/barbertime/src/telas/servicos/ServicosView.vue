<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsTabela } from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import ServicoDialogo from './ServicoDialogo.vue';

const servicos = ref([]);
const dialogoAberto = ref(false);
const selecionadoId = ref(null);

const colunas = [
  { campo: 'nome', titulo: 'Serviço', ordenavel: true },
  {
    campo: 'duracao',
    titulo: 'Duração',
    alinhamento: 'centro',
    formatar: (v) => `${v} min`,
  },
  {
    campo: 'preco',
    titulo: 'Preço',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
];

async function carregar() {
  servicos.value = await api.servicos.listar();
}
onMounted(carregar);

function abrir(id = null) {
  selecionadoId.value = id;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Serviços" :sobretitulo="`${servicos.length} no catálogo`">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo serviço
      </DsBotao>
    </template>
    <DsTabela
      :colunas="colunas"
      :linhas="servicos"
      texto-vazio="Nenhum serviço cadastrado"
      @selecionar="(s) => abrir(s.id)"
    />
    <ServicoDialogo
      :id="selecionadoId"
      v-model="dialogoAberto"
      @salvo="carregar"
    />
  </DsPagina>
</template>
