<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  DsBotao,
  DsIcone,
  DsIndicador,
  DsInputData,
  DsPagina,
  DsSelect,
  DsTabela,
  useConfirmacao,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { EmJson, LinhaDeComissao } from '@barbertime/contratos';

function dataHoje(): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function primeiroDiaMes(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`;
}

const hoje = dataHoje();
const de = ref(primeiroDiaMes());
const ate = ref(hoje);
const barbeiroIdSelecionado = ref<number | 0>(0);

type Barbeiro = { id: number; nome: string };
const barbeiros = ref<Barbeiro[]>([]);
const linhas = ref<EmJson<LinhaDeComissao>[]>([]);
const carregando = ref(false);
const fechando = ref(false);
const notificar = useNotificacao();
const confirmar = useConfirmacao();

const opcoesBarbeiros = computed(() => [
  { valor: 0, rotulo: 'Todos os barbeiros' },
  ...barbeiros.value.map((b) => ({ valor: b.id, rotulo: b.nome })),
]);

const totalComissao = computed(() =>
  linhas.value.reduce((s, l) => s + Number(l.valor), 0),
);

const linhasPendentes = computed(() =>
  linhas.value.filter((l) => !l.fechamentoId),
);

const totalPendente = computed(() =>
  linhasPendentes.value.reduce((s, l) => s + Number(l.valor), 0),
);

const colunas: ColunaDaTabela<EmJson<LinhaDeComissao>>[] = [
  { campo: 'dataComanda', titulo: 'Data', formatar: (v) => formatarData(v as string) },
  { campo: 'barbeiroNome', titulo: 'Barbeiro' },
  { campo: 'comandaId', titulo: 'Comanda' },
  { campo: 'baseCalculo', titulo: 'Base', formatar: (v) => formatarMoeda(Number(v)) },
  { campo: 'taxa', titulo: 'Taxa', formatar: (v) => `${Number(v)}%` },
  { campo: 'valor', titulo: 'Comissão', formatar: (v) => formatarMoeda(Number(v)) },
  { campo: 'fechamentoId', titulo: 'Situação', formatar: (v) => (v ? 'Fechado' : 'Pendente') },
];

async function carregar() {
  carregando.value = true;
  try {
    linhas.value = await api.financeiro.comissao.listar(
      de.value,
      ate.value,
      barbeiroIdSelecionado.value || undefined,
    );
  } finally {
    carregando.value = false;
  }
}

async function fechar() {
  if (!barbeiroIdSelecionado.value) {
    notificar.aviso('Selecione um barbeiro para fechar o período.');
    return;
  }
  const ok = await confirmar(
    `Marcar ${formatarMoeda(totalPendente.value)} como pago para o barbeiro selecionado no período de ${formatarData(de.value)} a ${formatarData(ate.value)}?`,
    { titulo: 'Fechar período', textoOk: 'Fechar', perigo: true },
  );
  if (!ok) return;
  fechando.value = true;
  try {
    await api.financeiro.comissao.fechar({ barbeiroId: barbeiroIdSelecionado.value, de: de.value, ate: ate.value });
    notificar.sucesso('Período fechado com sucesso.');
    await carregar();
  } catch (e: unknown) {
    notificar.erro(e instanceof Error ? e.message : 'Erro ao fechar.');
  } finally {
    fechando.value = false;
  }
}

onMounted(async () => {
  barbeiros.value = (await api.barbeiros.listar()) as Barbeiro[];
  await carregar();
});
</script>

<template>
  <DsPagina titulo="Comissões" sobretitulo="Financeiro">
    <template #acoes>
      <DsBotao
        variante="primario"
        tamanho="sm"
        :desabilitado="!barbeiroIdSelecionado || !linhasPendentes.length || fechando"
        :carregando="fechando"
        @click="fechar"
      >
        <DsIcone nome="check" />
        Fechar período
      </DsBotao>
    </template>

    <div class="filtros">
      <DsInputData v-model="de" rotulo="De" :max="ate" />
      <DsInputData v-model="ate" rotulo="Até" :min="de" />
      <DsSelect
        v-model="barbeiroIdSelecionado"
        rotulo="Barbeiro"
        :opcoes="opcoesBarbeiros"
      />
      <DsBotao variante="secundario" tamanho="sm" :carregando="carregando" @click="carregar">
        <DsIcone nome="buscar" />
        Filtrar
      </DsBotao>
    </div>

    <div class="indicadores">
      <DsIndicador rotulo="Total no período" :valor="formatarMoeda(totalComissao)" />
      <DsIndicador rotulo="Pendente de pagamento" :valor="formatarMoeda(totalPendente)" />
    </div>

    <DsTabela
      titulo="Comissões"
      :colunas="colunas"
      :linhas="linhas"
      :carregando="carregando"
      texto-vazio="Nenhuma comissão no período"
    />
  </DsPagina>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--esp-3);
  padding: var(--esp-3) var(--esp-4);
  margin-block-end: var(--esp-4);
  background: var(--placa);
  border-radius: var(--raio-sm);
  border: 1px solid var(--linha);
}
.indicadores {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-espaco-md);
  margin-block-end: var(--ds-espaco-lg);
}
</style>
