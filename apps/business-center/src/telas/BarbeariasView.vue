<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  DsCaixaDeSelecao,
  DsEscolha,
  DsPagina,
  DsSelo,
  DsTabela,
} from '@barbertime/ui';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import { plataforma } from '../dados/plataforma.js';
import { SELOS } from './rotulos.js';

// Lista do Business Center: só agregados por barbearia (planejamento 0028).
const router = useRouter();
const barbearias = ref([]);
const carregando = ref(true);
const erro = ref('');
const selo = ref('todas');
const comPedido = ref(false);

const opcoesDeSelo = computed(() => [
  { valor: 'todas', rotulo: 'Todas', detalhe: String(barbearias.value.length) },
  ...Object.entries(SELOS).map(([valor, s]) => ({
    valor,
    rotulo: s.rotulo,
    detalhe: String(barbearias.value.filter((b) => b.selo === valor).length),
  })),
]);

const visiveis = computed(() =>
  barbearias.value.filter(
    (b) =>
      (selo.value === 'todas' || b.selo === selo.value) &&
      (!comPedido.value || b.modulosPendentes > 0),
  ),
);

const colunas = [
  { campo: 'nome', titulo: 'Barbearia', ordenavel: true },
  { campo: 'selo', titulo: 'Situação' },
  { campo: 'donoNome', titulo: 'Dono' },
  {
    campo: 'faturamentoMes',
    titulo: 'Faturamento do mês',
    alinhamento: 'fim',
    ordenavel: true,
    formatar: (v) => formatarMoeda(v),
  },
  {
    campo: 'ultimaComandaPaga',
    titulo: 'Última venda',
    formatar: (v) => (v ? formatarData(`${v}T12:00:00`) : '—'),
  },
  { campo: 'modulosPendentes', titulo: 'Pedidos', alinhamento: 'centro' },
  {
    campo: 'criadaEm',
    titulo: 'Desde',
    formatar: (v) => formatarData(v),
  },
];

onMounted(async () => {
  try {
    barbearias.value = await plataforma.barbearias();
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
});
</script>

<template>
  <DsPagina titulo="Barbearias" sobretitulo="Business Center">
    <div class="filtros">
      <DsEscolha
        v-model="selo"
        class="filtros__situacao"
        :opcoes="opcoesDeSelo"
        rotulo="Situação das barbearias"
      />
      <DsCaixaDeSelecao v-model="comPedido" rotulo="Só com pedido de módulo" />
    </div>
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    <DsTabela
      :linhas="visiveis"
      :colunas="colunas"
      :carregando="carregando"
      :itens-por-pagina="25"
      texto-vazio="Nenhuma barbearia nesta situação"
      @selecionar="(b) => router.push(`/barbearias/${b.id}`)"
    >
      <template #celula-nome="{ linha }">
        <span class="nome">{{ linha.nome }}</span>
        <span class="ds-corpo-sm ds-suave">/{{ linha.slug }}</span>
      </template>
      <template #celula-selo="{ valor }">
        <DsSelo :estado="SELOS[valor].estado">{{ SELOS[valor].rotulo }}</DsSelo>
      </template>
      <template #celula-donoNome="{ linha }">
        <span>{{ linha.donoNome ?? '—' }}</span>
        <span class="ds-corpo-sm ds-suave">{{ linha.donoEmail }}</span>
      </template>
      <template #celula-modulosPendentes="{ valor }">
        <DsSelo v-if="valor" estado="pendente">{{ valor }}</DsSelo>
        <span v-else class="ds-suave">—</span>
      </template>
    </DsTabela>
  </DsPagina>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-4);
  margin-block-end: var(--esp-4);
}
/* Base flexível: sem ela o flex encolhe o grid de opções a uma coluna só. */
.filtros__situacao {
  flex: 1 1 32rem;
  min-inline-size: 0;
}
.nome {
  display: block;
  font-weight: 600;
}
.erro {
  color: var(--perigo);
}
</style>
