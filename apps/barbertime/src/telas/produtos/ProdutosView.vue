<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsTabela } from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { moduloAtivo } from '../../sessao/sessao.ts';
import { ROTULO_DO_TIPO, formatarQuantidade } from '../estoque/rotulos.ts';
import ProdutoDialogo from './ProdutoDialogo.vue';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { Produto } from '../../dados/modelos.ts';

const produtos = ref<Produto[]>([]);
const dialogoAberto = ref(false);
const selecionadoId = ref<number | null>(null);
// Planejamento 0027: saldo e último custo só com o módulo "estoque".
const comEstoque = computed(() => moduloAtivo('estoque'));
const revenda = (p: Produto) => p.tipo !== 'consumivel';

// Saldo e último custo: só com o módulo de estoque.
const colunasDeEstoque: ColunaDaTabela<Produto>[] = [
  {
    campo: 'saldo',
    titulo: 'Saldo',
    alinhamento: 'fim',
    formatar: (v, p) => formatarQuantidade(v, p.unidade),
  },
  {
    campo: 'ultimoCusto',
    titulo: 'Último custo',
    alinhamento: 'fim',
    formatar: (v) => (v == null ? '—' : formatarMoeda(v)),
  },
];

const colunas = computed<ColunaDaTabela<Produto>[]>(() => [
  { campo: 'nome', titulo: 'Produto', ordenavel: true },
  {
    campo: 'tipo',
    titulo: 'Tipo',
    formatar: (v) => ROTULO_DO_TIPO[v ?? 'revenda'] ?? '',
  },
  {
    campo: 'preco',
    titulo: 'Preço de venda',
    alinhamento: 'fim',
    formatar: (v, p) => (revenda(p) ? formatarMoeda(v) : '—'),
  },
  {
    campo: 'comissao',
    titulo: 'Comissão',
    alinhamento: 'fim',
    formatar: (v, p) => (revenda(p) ? `${v}%` : '—'),
  },
  ...(comEstoque.value ? colunasDeEstoque : []),
]);

async function carregar() {
  produtos.value = await api.produtos.listar();
}
onMounted(carregar);

function abrir(id: number | null = null) {
  selecionadoId.value = id;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina
    titulo="Produtos"
    :sobretitulo="`${produtos.length} cadastrado${produtos.length === 1 ? '' : 's'}`"
  >
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo produto
      </DsBotao>
    </template>
    <p class="ds-corpo-sm ds-suave">
      Revenda é vendida no balcão e entra na comanda. Consumível é de uso
      interno (lâmina, gel) e não aparece na comanda.
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
