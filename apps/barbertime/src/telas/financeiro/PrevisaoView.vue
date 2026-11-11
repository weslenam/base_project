<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  DsBotao,
  DsEscolha,
  DsIcone,
  DsIndicador,
  DsPagina,
  DsSelo,
  DsTabela,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { formatarMoeda } from '@barbertime/ui-utils';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { PrevisaoFinanceira, SemanaDePrevisao } from '@barbertime/contratos';

// Previsão de fluxo de caixa (planejamento 0027, parte 2, fatia 2B).
const PERIODOS = [
  { valor: 30, rotulo: '30 dias' },
  { valor: 60, rotulo: '60 dias' },
  { valor: 90, rotulo: '90 dias' },
];

const periodo = ref(30);
const previsao = ref<PrevisaoFinanceira | null>(null);
const carregando = ref(false);

const colunasSemanas: ColunaDaTabela<SemanaDePrevisao>[] = [
  {
    campo: 'inicio',
    titulo: 'Semana',
    formatar: (v, linha) => `${v} – ${(linha as SemanaDePrevisao).fim}`,
  },
  { campo: 'receber', titulo: 'A receber', formatar: (v) => formatarMoeda(Number(v)) },
  { campo: 'pagar', titulo: 'A pagar', formatar: (v) => formatarMoeda(Number(v)) },
  { campo: 'saldo', titulo: 'Saldo', formatar: (v) => formatarMoeda(Number(v)) },
];

type LinhaCat = { nome: string; tipo: string; total: number };
const colunasCat: ColunaDaTabela<LinhaCat>[] = [
  { campo: 'nome', titulo: 'Categoria', ordenavel: true },
  {
    campo: 'tipo',
    titulo: 'Tipo',
    formatar: (v) => (v === 'pagar' ? 'A pagar' : 'A receber'),
  },
  { campo: 'total', titulo: 'Total', formatar: (v) => formatarMoeda(Number(v)) },
];

async function carregar() {
  carregando.value = true;
  try {
    previsao.value = await api.financeiro.previsao(periodo.value);
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);
</script>

<template>
  <DsPagina titulo="Previsão" sobretitulo="Financeiro">
    <template #acoes>
      <DsEscolha
        v-model="periodo"
        :opcoes="PERIODOS"
        rotulo="Período"
        @update:model-value="carregar"
      />
      <DsBotao variante="secundario" :carregando="carregando" @click="carregar">
        <DsIcone nome="buscar" />
        Atualizar
      </DsBotao>
    </template>

    <template v-if="previsao">
      <div class="indicadores">
        <DsIndicador
          rotulo="Vencido a pagar"
          :valor="formatarMoeda(previsao.vencidaPagar)"
        />
        <DsIndicador
          rotulo="Vencido a receber"
          :valor="formatarMoeda(previsao.vencidaReceber)"
        />
        <DsIndicador
          rotulo="A pagar no período"
          :valor="formatarMoeda(previsao.totalPagar)"
        />
        <DsIndicador
          rotulo="A receber no período"
          :valor="formatarMoeda(previsao.totalReceber)"
        />
        <DsIndicador
          rotulo="Saldo previsto"
          :valor="formatarMoeda(previsao.saldoPrevisto)"
        />
      </div>

      <DsTabela
        titulo="Por semana"
        :colunas="colunasSemanas"
        :linhas="previsao.semanas"
        texto-vazio="Nenhuma conta no período"
      >
        <template #celula-saldo="{ linha }">
          <DsSelo :estado="(linha as SemanaDePrevisao).saldo >= 0 ? 'confirmado' : 'cancelado'">
            {{ formatarMoeda((linha as SemanaDePrevisao).saldo) }}
          </DsSelo>
        </template>
      </DsTabela>

      <DsTabela
        titulo="Por categoria"
        :colunas="colunasCat"
        :linhas="previsao.categorias"
        texto-vazio="Sem categorias"
      />
    </template>
  </DsPagina>
</template>

<style scoped>
.indicadores {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-espaco-md);
  margin-block-end: var(--ds-espaco-lg);
}
</style>
