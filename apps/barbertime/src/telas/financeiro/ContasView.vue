<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  DsBotao,
  DsIcone,
  DsIndicador,
  DsPagina,
  DsSelect,
  DsSelo,
  DsTabela,
} from '@barbertime/ui';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import { hojeIso, totaisDasContas } from '@barbertime/dominio';
import { api } from '../../dados/api.js';
import { SITUACOES, seloDaSituacao } from './rotulos.js';
import ContaDialogo from './ContaDialogo.vue';

// Contas a pagar e a receber (planejamento 0027, parte 2, fatia 2A).
const TIPOS = [
  { valor: 'pagar', rotulo: 'A pagar' },
  { valor: 'receber', rotulo: 'A receber' },
];
const tipo = ref('pagar');
const situacao = ref('aberta');
const contas = ref([]);
const carregando = ref(false);
const dialogoAberto = ref(false);
const selecionada = ref(null);

const colunas = [
  {
    campo: 'vencimento',
    titulo: 'Vencimento',
    formatar: formatarData,
    ordenavel: true,
  },
  { campo: 'descricao', titulo: 'Descrição' },
  { campo: 'categoriaNome', titulo: 'Categoria' },
  {
    campo: 'valor',
    titulo: 'Valor',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
  { campo: 'situacaoAtual', titulo: 'Situação' },
];

// Totais das contas carregadas, pela situação que vem da API.
const totais = computed(() => totaisDasContas(contas.value, hojeIso()));
const rotuloPago = computed(() =>
  tipo.value === 'receber' ? 'Recebido' : 'Pago',
);

// Só a resposta do pedido mais recente vale: trocar os filtros rápido não
// mostra o resultado de um filtro antigo (issue #30).
let pedido = 0;
async function carregar() {
  const meu = ++pedido;
  carregando.value = true;
  try {
    const lista = await api.financeiro.contas.listar({
      tipo: tipo.value,
      situacao: situacao.value,
    });
    if (meu === pedido) contas.value = lista;
  } finally {
    if (meu === pedido) carregando.value = false;
  }
}
onMounted(carregar);
watch([tipo, situacao], carregar);

function abrir(conta = null) {
  selecionada.value = conta;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Contas" sobretitulo="Financeiro">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Nova conta
      </DsBotao>
    </template>

    <div class="contas__filtros">
      <DsSelect v-model="tipo" :opcoes="TIPOS" rotulo="Tipo" />
      <DsSelect v-model="situacao" :opcoes="SITUACOES" rotulo="Situação" />
    </div>

    <div class="contas__totais">
      <DsIndicador rotulo="Em aberto" :valor="formatarMoeda(totais.aberto)" />
      <DsIndicador rotulo="Vencido" :valor="formatarMoeda(totais.vencido)" />
      <DsIndicador
        :rotulo="rotuloPago"
        :valor="formatarMoeda(totais.quitado)"
      />
    </div>

    <DsTabela
      :colunas="colunas"
      :linhas="contas"
      :carregando="carregando"
      texto-vazio="Nenhuma conta nesta situação"
      @selecionar="abrir"
    >
      <template #celula-situacaoAtual="{ linha }">
        <DsSelo
          :estado="seloDaSituacao(linha.situacaoAtual, linha.tipo).estado"
        >
          {{ seloDaSituacao(linha.situacaoAtual, linha.tipo).texto }}
        </DsSelo>
      </template>
    </DsTabela>

    <ContaDialogo
      v-model="dialogoAberto"
      :conta="selecionada"
      :tipo="tipo"
      @alterada="carregar"
    />
  </DsPagina>
</template>

<style scoped>
.contas__filtros {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 16rem));
  gap: var(--esp-3);
  margin-bottom: var(--esp-2);
}
.contas__totais {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: var(--esp-3);
  margin-bottom: var(--esp-4);
}
</style>
