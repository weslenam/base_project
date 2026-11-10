<script setup lang="ts" generic="L extends object">
import { computed } from 'vue';
import { VDataTable } from 'vuetify/components/VDataTable';
import type { ColunaDaTabela } from '../tipos.ts';

const props = withDefaults(
  defineProps<{
    linhas?: L[];
    /** [{ campo, titulo, alinhamento?: 'inicio'|'centro'|'fim', ordenavel?, formatar?: (valor, linha) => texto }] */
    colunas: ColunaDaTabela<L>[];
    /** Campo que identifica cada linha. */
    chave?: string;
    carregando?: boolean;
    itensPorPagina?: number;
    /** Mostra todas as linhas, sem rodapé de paginação (listas curtas, ex.: itens da comanda). */
    semRodape?: boolean;
    /** Linhas mais baixas, para listas curtas dentro de diálogos. */
    compacta?: boolean;
    textoVazio?: string;
  }>(),
  {
    linhas: () => [],
    chave: 'id',
    itensPorPagina: 10,
    textoVazio: 'Nenhum registro encontrado',
  },
);
const emit = defineEmits<{ selecionar: [linha: L] }>();

const ALINHAMENTOS = {
  inicio: 'start',
  centro: 'center',
  fim: 'end',
} as const;

const cabecalhos = computed(() =>
  props.colunas.map((c) => {
    const formatar = c.formatar;
    return {
      key: c.campo,
      title: c.titulo,
      align: c.alinhamento ? ALINHAMENTOS[c.alinhamento] : 'start',
      sortable: c.ordenavel ?? false,
      value: formatar
        ? (linha: L) =>
            formatar((linha as Record<string, unknown>)[c.campo], linha)
        : c.campo,
    };
  }),
);

function aoClicarLinha(_evento: Event, { item }: { item: L }) {
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
    :density="compacta ? 'compact' : 'default'"
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
  min-inline-size: 0;
  max-inline-size: 100%;
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
