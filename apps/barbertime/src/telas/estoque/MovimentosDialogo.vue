<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DsDialogo, DsTabela } from '@barbertime/ui';
import { formatarData } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { ROTULO_DO_MOVIMENTO, formatarQuantidade } from './rotulos.ts';
import type { PropType } from 'vue';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { MovimentoEstoque, ProdutoEstoque } from '../../dados/modelos.ts';

// Últimos movimentos de um produto (planejamento 0027).
const props = defineProps({
  produto: { type: Object as PropType<ProdutoEstoque | null>, default: null },
});
const emit = defineEmits(['fechar']);

const movimentos = ref<MovimentoEstoque[]>([]);
const carregando = ref(false);
const aberto = computed({
  get: () => Boolean(props.produto),
  set: (v: boolean) => !v && emit('fechar'),
});

const colunas = computed<ColunaDaTabela<MovimentoEstoque>[]>(() => [
  {
    campo: 'criadoEm',
    titulo: 'Data',
    formatar: (v) => formatarData(v),
  },
  {
    campo: 'tipo',
    titulo: 'Movimento',
    formatar: (v) => ROTULO_DO_MOVIMENTO[v] ?? v,
  },
  {
    campo: 'quantidade',
    titulo: 'Quantidade',
    alinhamento: 'fim',
    formatar: (v) =>
      `${v > 0 ? '+' : ''}${formatarQuantidade(v, props.produto?.unidade)}`,
  },
  { campo: 'motivo', titulo: 'Motivo' },
  { campo: 'usuarioNome', titulo: 'Quem' },
]);

watch(
  () => props.produto,
  async (p) => {
    movimentos.value = [];
    if (!p) return;
    carregando.value = true;
    try {
      movimentos.value = await api.estoque.movimentos({
        produtoId: p.id,
        limite: 50,
      });
    } finally {
      carregando.value = false;
    }
  },
);
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="produto ? `Movimentos de ${produto.nome}` : 'Movimentos'"
    largura="lg"
    fechavel
  >
    <DsTabela
      :colunas="colunas"
      :linhas="movimentos"
      :carregando="carregando"
      compacta
      texto-vazio="Nenhum movimento ainda"
    />
  </DsDialogo>
</template>
