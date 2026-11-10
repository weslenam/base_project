<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsSelo, DsTabela } from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { pode } from '../../sessao/sessao.ts';
import { formatarDataIso } from './rotulos.ts';
import CompraDialogo from './CompraDialogo.vue';
import NovaCompraDialogo from './NovaCompraDialogo.vue';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { CompraResumida } from '../../dados/modelos.ts';

// Compras (planejamento 0027, parte 1): registro da compra já recebida, com
// entrada no estoque e parcelas a pagar. Sem edição: cancela e lança de novo.
const compras = ref<CompraResumida[]>([]);
const novaAberta = ref(false);
const detalheId = ref<number | null>(null);
const gerencia = computed(() => pode('estoque.gerenciar'));

const colunas: ColunaDaTabela<CompraResumida>[] = [
  { campo: 'data', titulo: 'Data', formatar: formatarDataIso },
  { campo: 'fornecedorNome', titulo: 'Fornecedor' },
  {
    campo: 'total',
    titulo: 'Total',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
  {
    campo: 'parcelas',
    titulo: 'Parcelas',
    alinhamento: 'fim',
    formatar: (v, c) => (v ? `${c.quitadas}/${v} pagas` : '—'),
  },
  { campo: 'cancelada', titulo: 'Situação' },
];

async function carregar() {
  compras.value = await api.compras.listar();
}
onMounted(carregar);
</script>

<template>
  <DsPagina
    titulo="Compras"
    :sobretitulo="`${compras.length} registrada${compras.length === 1 ? '' : 's'}`"
  >
    <template v-if="gerencia" #acoes>
      <DsBotao @click="novaAberta = true">
        <DsIcone nome="adicionar" />
        Nova compra
      </DsBotao>
    </template>
    <DsTabela
      :colunas="colunas"
      :linhas="compras"
      texto-vazio="Nenhuma compra registrada"
      @selecionar="(c) => (detalheId = c.id)"
    >
      <template #celula-cancelada="{ linha }">
        <DsSelo :estado="linha.cancelada ? 'faltou' : 'confirmado'">
          {{ linha.cancelada ? 'Cancelada' : 'Recebida' }}
        </DsSelo>
      </template>
    </DsTabela>
    <NovaCompraDialogo v-model="novaAberta" @salvo="carregar" />
    <CompraDialogo
      :id="detalheId"
      @fechar="detalheId = null"
      @alterada="carregar"
    />
  </DsPagina>
</template>
