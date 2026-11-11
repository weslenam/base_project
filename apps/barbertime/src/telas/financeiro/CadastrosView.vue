<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  DsAbas,
  DsBotao,
  DsIcone,
  DsPagina,
  DsSelo,
  DsTabela,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import CategoriaDialogo from './CategoriaDialogo.vue';
import RecorrenciaDialogo from './RecorrenciaDialogo.vue';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { Categoria } from '../../dados/modelos.ts';
import type { RecorrenciaFinanceira } from '@barbertime/contratos';
import { formatarMoeda } from '@barbertime/ui-utils';

// Cadastros do financeiro (planejamento 0027, parte 2, fatia 2B): categorias e
// recorrências em abas.

type Aba = 'categorias' | 'recorrencias';
const aba = ref<Aba>('categorias');
const ABAS = [
  { valor: 'categorias', rotulo: 'Categorias' },
  { valor: 'recorrencias', rotulo: 'Recorrências' },
];

// --- categorias ---
const categorias = ref<Categoria[]>([]);
const dialogoCatAberto = ref(false);
const categoriaSelecionada = ref<Categoria | null>(null);

const colunasCat: ColunaDaTabela<Categoria>[] = [
  { campo: 'nome', titulo: 'Categoria', ordenavel: true },
  {
    campo: 'tipo',
    titulo: 'Tipo',
    formatar: (v) => (v === 'pagar' ? 'A pagar' : 'A receber'),
  },
  { campo: 'ativa', titulo: 'Situação' },
];

async function carregarCategorias() {
  categorias.value = await api.financeiro.categorias.listar();
}

function abrirCategoria(cat: Categoria | null = null) {
  categoriaSelecionada.value = cat;
  dialogoCatAberto.value = true;
}

// --- recorrências ---
const recorrencias = ref<RecorrenciaFinanceira[]>([]);
const dialogoRecAberto = ref(false);
const recorrenciaSelecionada = ref<RecorrenciaFinanceira | null>(null);

const colunasRec: ColunaDaTabela<RecorrenciaFinanceira>[] = [
  { campo: 'descricao', titulo: 'Descrição', ordenavel: true },
  {
    campo: 'tipo',
    titulo: 'Tipo',
    formatar: (v) => (v === 'pagar' ? 'A pagar' : 'A receber'),
  },
  {
    campo: 'valor',
    titulo: 'Valor',
    formatar: (v) => formatarMoeda(Number(v)),
  },
  { campo: 'diaDoMes', titulo: 'Dia' },
  { campo: 'encerradaEm', titulo: 'Situação' },
];

async function carregarRecorrencias() {
  recorrencias.value = await api.financeiro.recorrencias.listar();
}

function abrirRecorrencia(rec: RecorrenciaFinanceira | null = null) {
  recorrenciaSelecionada.value = rec;
  dialogoRecAberto.value = true;
}

onMounted(async () => {
  await Promise.all([carregarCategorias(), carregarRecorrencias()]);
});
</script>

<template>
  <DsPagina titulo="Cadastros" sobretitulo="Financeiro">
    <template #acoes>
      <DsBotao v-if="aba === 'categorias'" @click="abrirCategoria()">
        <DsIcone nome="adicionar" />
        Nova categoria
      </DsBotao>
      <DsBotao v-else @click="abrirRecorrencia()">
        <DsIcone nome="adicionar" />
        Nova recorrência
      </DsBotao>
    </template>

    <DsAbas v-model="aba" :abas="ABAS" rotulo="Seções dos cadastros financeiros" />

    <div v-show="aba === 'categorias'">
      <DsTabela
        :colunas="colunasCat"
        :linhas="categorias"
        :itens-por-pagina="20"
        texto-vazio="Nenhuma categoria"
        @selecionar="abrirCategoria"
      >
        <template #celula-ativa="{ linha }">
          <DsSelo :estado="linha.ativa ? 'confirmado' : 'neutro'">
            {{ linha.ativa ? 'Ativa' : 'Desativada' }}
          </DsSelo>
        </template>
      </DsTabela>
    </div>

    <div v-show="aba === 'recorrencias'">
      <DsTabela
        :colunas="colunasRec"
        :linhas="recorrencias"
        :itens-por-pagina="20"
        texto-vazio="Nenhuma recorrência"
        @selecionar="abrirRecorrencia"
      >
        <template #celula-encerrada-em="{ linha }">
          <DsSelo :estado="linha.encerradaEm ? 'neutro' : 'confirmado'">
            {{ linha.encerradaEm ? 'Encerrada' : 'Ativa' }}
          </DsSelo>
        </template>
      </DsTabela>
    </div>

    <CategoriaDialogo
      v-model="dialogoCatAberto"
      :categoria="categoriaSelecionada"
      @alterada="carregarCategorias"
    />
    <RecorrenciaDialogo
      v-model="dialogoRecAberto"
      :recorrencia="recorrenciaSelecionada"
      @alterada="carregarRecorrencias"
    />
  </DsPagina>
</template>
