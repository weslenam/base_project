<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  DsBotao,
  DsCartao,
  DsIcone,
  DsPagina,
  DsSelo,
  DsTabela,
} from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { pode } from '../../sessao/sessao.ts';
import { ROTULO_DO_TIPO, formatarQuantidade } from './rotulos.ts';
import ConsumoDialogo from './ConsumoDialogo.vue';
import InventarioDialogo from './InventarioDialogo.vue';
import MovimentosDialogo from './MovimentosDialogo.vue';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { sugestaoDeCompra } from '@barbertime/dominio';
import type { ProdutoEstoque } from '../../dados/modelos.ts';

// Estoque (planejamento 0027, parte 1): saldos, "Comprar", consumo manual,
// inventário e movimentos por produto. A Recepção só vê.
const produtos = ref<ProdutoEstoque[]>([]);
const comprar = ref<ReturnType<typeof sugestaoDeCompra>>([]);
const consumoAberto = ref(false);
const inventarioAberto = ref(false);
const movimentosDe = ref<ProdutoEstoque | null>(null);
const gerencia = computed(() => pode('estoque.gerenciar'));

const unidadeDe = (id: number) =>
  produtos.value.find((p) => p.id === id)?.unidade;

const colunas: ColunaDaTabela<ProdutoEstoque>[] = [
  { campo: 'nome', titulo: 'Produto', ordenavel: true },
  { campo: 'tipo', titulo: 'Tipo', formatar: (v) => ROTULO_DO_TIPO[v] ?? '' },
  { campo: 'saldo', titulo: 'Saldo', alinhamento: 'fim' },
  {
    campo: 'estoqueMinimo',
    titulo: 'Mínimo',
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

async function carregar() {
  ({ produtos: produtos.value, comprar: comprar.value } =
    await api.estoque.obter());
}
onMounted(carregar);
</script>

<template>
  <DsPagina titulo="Estoque" :sobretitulo="`${produtos.length} produtos`">
    <template v-if="gerencia" #acoes>
      <DsBotao variante="secundario" @click="inventarioAberto = true">
        Inventário
      </DsBotao>
      <DsBotao @click="consumoAberto = true">
        <DsIcone nome="adicionar" />
        Registrar consumo
      </DsBotao>
    </template>

    <DsCartao v-if="comprar.length" titulo="Comprar">
      <ul class="comprar" aria-label="Produtos para comprar">
        <li v-for="c in comprar" :key="c.produtoId" class="comprar__item">
          <span class="comprar__nome">{{ c.nome }}</span>
          <DsSelo :estado="c.negativo ? 'faltou' : 'pendente'">
            {{ c.negativo ? 'Negativo' : 'No mínimo' }}
          </DsSelo>
          <span class="ds-corpo-sm ds-suave">
            Saldo {{ formatarQuantidade(c.saldo, unidadeDe(c.produtoId)) }} ·
            comprar
            {{ formatarQuantidade(c.sugerido, unidadeDe(c.produtoId)) }}
          </span>
        </li>
      </ul>
    </DsCartao>

    <p class="ds-corpo-sm ds-suave">
      Toque no produto para ver os movimentos. O saldo muda só por compra,
      venda, consumo ou inventário.
    </p>
    <DsTabela
      :colunas="colunas"
      :linhas="produtos"
      texto-vazio="Nenhum produto cadastrado"
      @selecionar="(p) => (movimentosDe = p)"
    >
      <template #celula-saldo="{ linha }">
        <span :class="{ negativo: linha.saldo < 0 }">
          {{ formatarQuantidade(linha.saldo, linha.unidade) }}
        </span>
      </template>
    </DsTabela>

    <ConsumoDialogo
      v-model="consumoAberto"
      :produtos="produtos"
      @salvo="carregar"
    />
    <InventarioDialogo
      v-model="inventarioAberto"
      :produtos="produtos"
      @salvo="carregar"
    />
    <MovimentosDialogo :produto="movimentosDe" @fechar="movimentosDe = null" />
  </DsPagina>
</template>

<style scoped>
.comprar {
  display: grid;
  gap: var(--esp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.comprar__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-2);
}
.comprar__nome {
  font-weight: 600;
}
.negativo {
  color: var(--perigo);
  font-weight: 600;
}
</style>
