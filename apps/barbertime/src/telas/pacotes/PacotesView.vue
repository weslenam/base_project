<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsTabela } from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import PacoteDialogo from './PacoteDialogo.vue';
import {
  descreverItens,
  descreverLimites,
  descreverPreco,
  descreverVigencia,
} from './descricao.ts';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { Pacote } from '../../dados/modelos.ts';

const pacotes = ref<Pacote[]>([]);
const dialogoAberto = ref(false);
const selecionado = ref<Pacote | null>(null);

const colunas: ColunaDaTabela<Pacote>[] = [
  { campo: 'nome', titulo: 'Pacote', ordenavel: true },
  { campo: 'itens', titulo: 'Serviços', formatar: (v, p) => descreverItens(p) },
  {
    campo: 'tipo',
    titulo: 'Vigência',
    formatar: (v, p) => descreverVigencia(p),
  },
  { campo: 'limites', titulo: 'Uso', formatar: (v, p) => descreverLimites(p) },
  {
    campo: 'preco',
    titulo: 'Preço',
    alinhamento: 'fim',
    formatar: (v, p) => descreverPreco(p),
  },
];

async function carregar() {
  pacotes.value = await api.pacotes.listar();
}
onMounted(carregar);

function abrir(pacote: Pacote | null = null) {
  selecionado.value = pacote;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Pacotes" :sobretitulo="`${pacotes.length} à venda`">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo pacote
      </DsBotao>
    </template>
    <p class="ds-corpo-sm ds-suave">
      Pacotes por quantidade (ex.: 4 cortes) ou livres, mensais ou de compra
      única com validade. O uso no balcão fica registrado em cada pacote do
      cliente.
    </p>
    <DsTabela
      :colunas="colunas"
      :linhas="pacotes"
      texto-vazio="Nenhum pacote cadastrado"
      @selecionar="abrir"
    />
    <PacoteDialogo
      v-model="dialogoAberto"
      :pacote="selecionado"
      @salvo="carregar"
    />
  </DsPagina>
</template>
