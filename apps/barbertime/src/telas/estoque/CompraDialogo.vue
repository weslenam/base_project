<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PropType } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsSelo,
  DsTabela,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { pode } from '../../sessao/sessao.ts';
import { formatarDataIso, formatarQuantidade } from './rotulos.ts';
import type { ColunaDaTabela, EstadoVisual } from '@barbertime/ui';
import type { Compra } from '../../dados/modelos.ts';

// Detalhe da compra: itens, totais, parcelas e cancelamento.
const props = defineProps({
  id: { type: Number as PropType<number | null>, default: null },
});
const emit = defineEmits(['fechar', 'alterada']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const compra = ref<Compra | null>(null);
const aberto = computed({
  get: () => Boolean(props.id),
  set: (v: boolean) => !v && emit('fechar'),
});
const podeCancelar = computed(
  () =>
    pode('estoque.gerenciar') &&
    compra.value &&
    !compra.value.cancelada &&
    !compra.value.parcelas.some((p) => p.situacao === 'quitada'),
);

const SITUACAO: Record<string, [EstadoVisual, string]> = {
  aberta: ['pendente', 'Em aberto'],
  quitada: ['confirmado', 'Paga'],
  cancelada: ['faltou', 'Cancelada'],
};

const colunasItens: ColunaDaTabela<Compra['itens'][number]>[] = [
  { campo: 'nome', titulo: 'Produto' },
  {
    campo: 'quantidade',
    titulo: 'Quantidade',
    alinhamento: 'fim',
    formatar: (v, i) => formatarQuantidade(v, i.unidade),
  },
  {
    campo: 'custoUnitario',
    titulo: 'Custo unitário',
    alinhamento: 'fim',
    formatar: (v) => formatarMoeda(v),
  },
];
const colunasParcelas: ColunaDaTabela<Compra['parcelas'][number]>[] = [
  {
    campo: 'parcela',
    titulo: 'Parcela',
    formatar: (v, p) => `${v}/${p.parcelas}`,
  },
  { campo: 'vencimento', titulo: 'Vencimento', formatar: formatarDataIso },
  {
    campo: 'valor',
    titulo: 'Valor',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
  { campo: 'situacao', titulo: 'Situação' },
];

watch(
  () => props.id,
  async (id) => {
    compra.value = null;
    if (id) compra.value = await api.compras.obter(id);
  },
);

async function cancelar() {
  const id = props.id;
  if (id === null) return;
  const ok = await confirmar(
    'Cancelar esta compra? O estoque é estornado e as parcelas em aberto são canceladas.',
    { perigo: true, textoOk: 'Cancelar compra', textoCancelar: 'Manter' },
  );
  if (!ok) return;
  const r = await executar(() => api.compras.cancelar(id));
  if (!r) return;
  compra.value = r;
  notificar.sucesso('Compra cancelada.');
  emit('alterada');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="
      compra ? `Compra #${compra.id} · ${compra.fornecedorNome}` : 'Compra'
    "
    largura="lg"
    fechavel
  >
    <div v-if="compra" class="compra">
      <p class="ds-corpo-sm ds-suave">
        {{ formatarDataIso(compra.data) }}
        <DsSelo v-if="compra.cancelada" estado="faltou">Cancelada</DsSelo>
      </p>
      <DsTabela
        :colunas="colunasItens"
        :linhas="compra.itens"
        chave="produtoId"
        compacta
        sem-rodape
      />
      <dl class="totais">
        <dt>Frete</dt>
        <dd class="ds-valor">{{ formatarMoeda(compra.frete) }}</dd>
        <dt>Desconto</dt>
        <dd class="ds-valor">{{ formatarMoeda(compra.desconto) }}</dd>
        <dt>Total</dt>
        <dd class="ds-valor">{{ formatarMoeda(compra.total) }}</dd>
      </dl>
      <p class="ds-rotulo">Parcelas</p>
      <DsTabela
        :colunas="colunasParcelas"
        :linhas="compra.parcelas"
        compacta
        sem-rodape
        texto-vazio="Sem parcelas (compra sem valor)"
      >
        <template #celula-situacao="{ linha }">
          <DsSelo :estado="SITUACAO[linha.situacao][0]">
            {{ SITUACAO[linha.situacao][1] }}
          </DsSelo>
        </template>
      </DsTabela>
      <p v-if="compra.observacao" class="ds-corpo-sm">
        {{ compra.observacao }}
      </p>
    </div>
    <template v-if="podeCancelar" #acoes>
      <DsBotao variante="perigo" @click="cancelar">Cancelar compra</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.compra {
  display: grid;
  gap: var(--esp-3);
}
.compra p {
  margin: 0;
}
.totais {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: end;
  gap: var(--esp-1) var(--esp-4);
  margin: 0;
}
.totais dd {
  margin: 0;
  text-align: right;
}
</style>
