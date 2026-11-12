<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  DsBotao,
  DsIcone,
  DsIndicador,
  DsInputData,
  DsPagina,
  DsSelo,
  DsTabela,
} from '@barbertime/ui';
import { inicioDaSemana, somarDias } from '@barbertime/dominio';
import { api } from '../../dados/api.ts';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { PrevisaoFinanceira, SemanaDePrevisao } from '@barbertime/contratos';

// Previsão de fluxo de caixa (planejamento 0027, parte 2, fatia 2B).
const PERIODOS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 60, rotulo: '60 dias' },
  { dias: 90, rotulo: '90 dias' },
];

function dataHoje(): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

const hoje = dataHoje();
const inicio = ref(hoje);
const fim = ref(somarDias(hoje, 30));
const periodoAtivo = ref<number | null>(30);
const personalizado = ref(false);
const inicioPicker = ref(inicioDaSemana(dataHoje()));
const fimPicker = ref(somarDias(dataHoje(), 30));
const previsao = ref<PrevisaoFinanceira | null>(null);
const carregando = ref(false);

function aplicarRapido(dias: number) {
  const h = dataHoje();
  inicio.value = h;
  fim.value = somarDias(h, dias);
  periodoAtivo.value = dias;
  personalizado.value = false;
  carregar();
}

function aplicarPersonalizado() {
  inicio.value = inicioPicker.value;
  fim.value = fimPicker.value;
  periodoAtivo.value = null;
  personalizado.value = false;
  carregar();
}

const colunasSemanas: ColunaDaTabela<SemanaDePrevisao>[] = [
  {
    campo: 'inicio',
    titulo: 'Semana',
    formatar: (v, linha) => `${formatarData(v as string)} – ${formatarData((linha as SemanaDePrevisao).fim)}`,
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
    previsao.value = await api.financeiro.previsao(inicio.value, fim.value);
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);
</script>

<template>
  <DsPagina titulo="Previsão" sobretitulo="Financeiro">
    <template #acoes>
      <div class="periodo-grupo">
        <DsBotao
          v-for="p in PERIODOS"
          :key="p.dias"
          :variante="periodoAtivo === p.dias ? 'primario' : 'secundario'"
          tamanho="sm"
          @click="aplicarRapido(p.dias)"
        >
          {{ p.rotulo }}
        </DsBotao>
        <DsBotao
          :variante="personalizado ? 'primario' : 'secundario'"
          tamanho="sm"
          @click="personalizado = !personalizado"
        >
          <DsIcone nome="agenda" />
        </DsBotao>
      </div>
    </template>

    <div v-if="personalizado" class="periodo-custom">
      <DsInputData v-model="inicioPicker" rotulo="De" :max="fimPicker" />
      <DsInputData v-model="fimPicker" rotulo="Até" :min="inicioPicker" />
      <DsBotao variante="primario" tamanho="sm" :desabilitado="!inicioPicker || !fimPicker || fimPicker < inicioPicker" @click="aplicarPersonalizado">
        Aplicar
      </DsBotao>
    </div>

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
.periodo-grupo {
  display: flex;
  gap: var(--esp-1);
}
.periodo-custom {
  display: flex;
  align-items: flex-end;
  gap: var(--esp-3);
  padding: var(--esp-3) var(--esp-4);
  margin-block-end: var(--esp-4);
  background: var(--placa);
  border-radius: var(--raio-sm);
  border: 1px solid var(--linha);
}
@media (max-width: 40rem) {
  .periodo-custom {
    flex-wrap: wrap;
  }
}
</style>
