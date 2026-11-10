<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsSelo, DsTabela } from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import CategoriaDialogo from './CategoriaDialogo.vue';

// Cadastros do financeiro (planejamento 0027, parte 2). Fatia 2A: categorias;
// a 2B traz as recorrências para esta tela.
const categorias = ref([]);
const dialogoAberto = ref(false);
const selecionada = ref(null);

const colunas = [
  { campo: 'nome', titulo: 'Categoria', ordenavel: true },
  {
    campo: 'tipo',
    titulo: 'Tipo',
    formatar: (v) => (v === 'pagar' ? 'A pagar' : 'A receber'),
  },
  { campo: 'ativa', titulo: 'Situação' },
];

async function carregar() {
  categorias.value = await api.financeiro.categorias.listar();
}
onMounted(carregar);

function abrir(categoria = null) {
  selecionada.value = categoria;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Categorias" sobretitulo="Financeiro">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Nova categoria
      </DsBotao>
    </template>
    <DsTabela
      :colunas="colunas"
      :linhas="categorias"
      :itens-por-pagina="20"
      texto-vazio="Nenhuma categoria"
      @selecionar="abrir"
    >
      <template #celula-ativa="{ linha }">
        <DsSelo :estado="linha.ativa ? 'confirmado' : 'neutro'">
          {{ linha.ativa ? 'Ativa' : 'Desativada' }}
        </DsSelo>
      </template>
    </DsTabela>
    <CategoriaDialogo
      v-model="dialogoAberto"
      :categoria="selecionada"
      @alterada="carregar"
    />
  </DsPagina>
</template>
