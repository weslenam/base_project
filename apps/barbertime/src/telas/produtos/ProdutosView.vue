<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsTabela } from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import ProdutoDialogo from './ProdutoDialogo.vue';

const produtos = ref([]);
const dialogoAberto = ref(false);
const selecionadoId = ref(null);

const colunas = [
  { campo: 'nome', titulo: 'Produto', ordenavel: true },
  {
    campo: 'preco',
    titulo: 'Preço de venda',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
  {
    campo: 'comissao',
    titulo: 'Comissão',
    alinhamento: 'fim',
    formatar: (v) => `${v}%`,
  },
];

async function carregar() {
  produtos.value = await api.produtos.listar();
}
onMounted(carregar);

function abrir(id = null) {
  selecionadoId.value = id;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Produtos" :sobretitulo="`${produtos.length} à venda`">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo produto
      </DsBotao>
    </template>
    <p class="ds-corpo-sm ds-suave">
      Produtos vendidos no balcão. Entram na comanda junto com os serviços.
    </p>
    <DsTabela
      :colunas="colunas"
      :linhas="produtos"
      texto-vazio="Nenhum produto cadastrado"
      @selecionar="(p) => abrir(p.id)"
    />
    <ProdutoDialogo
      :id="selecionadoId"
      v-model="dialogoAberto"
      @salvo="carregar"
    />
  </DsPagina>
</template>
