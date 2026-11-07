<script setup>
import { computed } from 'vue';
import { VDataTable } from 'vuetify/components/VDataTable';

const props = defineProps({
  linhas: { type: Array, default: () => [] },
  /** [{ campo, titulo, alinhamento?: 'inicio'|'centro'|'fim', ordenavel?, formatar?: (valor, linha) => texto }] */
  colunas: { type: Array, required: true },
  /** Campo que identifica cada linha. */
  chave: { type: String, default: 'id' },
  carregando: Boolean,
  itensPorPagina: { type: Number, default: 10 },
  /** Mostra todas as linhas, sem rodapé de paginação (listas curtas, ex.: itens da comanda). */
  semRodape: Boolean,
  textoVazio: { type: String, default: 'Nenhum registro encontrado' },
});
const emit = defineEmits(['selecionar']);

const ALINHAMENTOS = { inicio: 'start', centro: 'center', fim: 'end' };

const cabecalhos = computed(() =>
  props.colunas.map((c) => ({
    key: c.campo,
    title: c.titulo,
    align: ALINHAMENTOS[c.alinhamento] ?? 'start',
    sortable: c.ordenavel ?? false,
    value: c.formatar ? (linha) => c.formatar(linha[c.campo], linha) : c.campo,
  })),
);

function aoClicarLinha(_evento, { item }) {
  emit('selecionar', item);
}
</script>

<template>
  <VDataTable
    class="ds-tabela"
    :headers="cabecalhos"
    :items="linhas"
    :item-value="chave"
    :loading="carregando"
    :items-per-page="semRodape ? -1 : itensPorPagina"
    :hide-default-footer="semRodape"
    :no-data-text="textoVazio"
    loading-text="Carregando..."
    items-per-page-text="Registros por página"
    hover
    @click:row="aoClicarLinha"
  >
    <template
      v-for="c in colunas"
      :key="c.campo"
      #[`item.${c.campo}`]="{ item, value }"
    >
      <slot
        :name="`celula-${c.campo}`"
        :linha="item"
        :coluna="c"
        :valor="value"
      >
        {{ value }}
      </slot>
    </template>
  </VDataTable>
</template>

<style scoped>
.ds-tabela {
  background: var(--placa);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  font-family: var(--font-sans);
}
.ds-tabela :deep(th) {
  background: var(--placa-funda);
  font: var(--tipo-rotulo);
  letter-spacing: var(--tipo-rotulo-espacamento);
  text-transform: uppercase;
  color: var(--grafite-suave);
}
.ds-tabela :deep(td),
.ds-tabela :deep(th) {
  border-color: var(--linha) !important;
}
</style>
