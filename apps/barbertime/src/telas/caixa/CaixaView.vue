<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  DsBotao,
  DsCartao,
  DsFormulario,
  DsIcone,
  DsInputMoeda,
  DsPagina,
  DsSelo,
  DsTabela,
  useNotificacao,
} from '@barbertime/ui';
import { formatarDiaCurto, formatarMoeda } from '@barbertime/ui-utils';
import { FORMAS_DE_PAGAMENTO, hojeIso } from '@barbertime/dominio';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { useSessao } from '../../sessao/sessao.ts';
import ComandaDialogo from './ComandaDialogo.vue';
import FecharCaixa from './FecharCaixa.vue';
import { rotuloDaForma, seloDaComanda } from './rotulos.js';

const route = useRoute();
const router = useRouter();
const notificar = useNotificacao();
const executar = useAcao();
// Abrir o caixa tem permissão própria (planejamento 0039, #19).
const { pode } = useSessao();
const podeAbrirCaixa = computed(() => pode('caixa.abrir'));

const caixa = ref(undefined);
const comandas = ref([]);
const trocoInicial = ref(0);
const comandaAberta = ref(false);
const comandaId = ref(null);
const fechamentoAberto = ref(false);

const colunas = [
  { campo: 'hora', titulo: 'Hora' },
  { campo: 'clienteNome', titulo: 'Cliente' },
  { campo: 'barbeiroNome', titulo: 'Barbeiro' },
  { campo: 'forma', titulo: 'Pagamento', formatar: rotuloDaForma },
  {
    campo: 'total',
    titulo: 'Total',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
  { campo: 'estado', titulo: 'Situação' },
];

async function carregar() {
  [caixa.value, comandas.value] = await Promise.all([
    api.caixa.obterDoDia(),
    api.comandas.listarDoDia(),
  ]);
}

function abrirComanda(id = null) {
  comandaId.value = id;
  comandaAberta.value = true;
}

onMounted(async () => {
  await carregar();
  if (route.query.comanda) {
    abrirComanda(Number(route.query.comanda));
    router.replace({ query: {} });
  }
});
watch(comandaAberta, (aberto) => !aberto && carregar());

async function abrirCaixa() {
  const aberto = await executar(() =>
    api.caixa.abrir({ valorInicial: trocoInicial.value ?? 0 }),
  );
  if (!aberto) return;
  notificar.sucesso('Caixa aberto. Bom trabalho!');
  await carregar();
}

const sobretitulo = computed(() => `Hoje · ${formatarDiaCurto(hojeIso())}`);
const formas = FORMAS_DE_PAGAMENTO;
</script>

<template>
  <DsPagina titulo="Caixa" :sobretitulo="sobretitulo">
    <template v-if="caixa?.aberto" #acoes>
      <DsBotao variante="secundario" @click="fechamentoAberto = true"
        >Fechar caixa</DsBotao
      >
      <DsBotao @click="abrirComanda()">
        <DsIcone nome="adicionar" />
        Nova comanda
      </DsBotao>
    </template>

    <!-- Sem caixa hoje: abrir -->
    <DsCartao
      v-if="caixa === null && podeAbrirCaixa"
      titulo="Abrir o caixa"
      class="abrir"
    >
      <p class="ds-suave">
        Informe o troco que está na gaveta para começar o dia.
      </p>
      <DsFormulario id="form-abrir-caixa" @enviar="abrirCaixa">
        <DsInputMoeda v-model="trocoInicial" rotulo="Troco inicial" />
      </DsFormulario>
      <template #acoes>
        <DsBotao formulario="form-abrir-caixa">Abrir caixa</DsBotao>
      </template>
    </DsCartao>
    <DsCartao v-else-if="caixa === null" titulo="Caixa fechado" class="abrir">
      <p class="ds-suave">
        O caixa de hoje ainda não foi aberto. Peça à recepção ou ao gerente para
        abrir.
      </p>
    </DsCartao>

    <template v-else-if="caixa">
      <!-- Caixa fechado hoje -->
      <DsCartao
        v-if="!caixa.aberto"
        :titulo="`Caixa fechado às ${caixa.fechadoAs}`"
      >
        <p>
          Dinheiro contado:
          <span class="ds-valor">{{
            formatarMoeda(caixa.dinheiroContado)
          }}</span>
          · esperado:
          <span class="ds-valor">{{
            formatarMoeda(caixa.resumo.dinheiroEsperado)
          }}</span>
        </p>
        <DsSelo v-if="caixa.diferenca === 0" estado="confirmado">Bateu</DsSelo>
        <DsSelo v-else-if="caixa.diferenca < 0" estado="faltou">
          Faltaram {{ formatarMoeda(-caixa.diferenca) }}
        </DsSelo>
        <DsSelo v-else estado="pendente"
          >Sobraram {{ formatarMoeda(caixa.diferenca) }}</DsSelo
        >
      </DsCartao>

      <section class="resumo" aria-label="Resumo do caixa">
        <div class="resumo__total">
          <p class="ds-rotulo">Recebido hoje</p>
          <p class="ds-display">
            {{ formatarMoeda(caixa.resumo.totalRecebido) }}
          </p>
          <p class="ds-corpo-sm ds-suave">
            {{ caixa.resumo.pagas }} comandas pagas ·
            {{ caixa.resumo.abertas }} em aberto
          </p>
        </div>
        <div v-for="f in formas" :key="f.valor" class="resumo__forma">
          <p class="ds-rotulo">{{ f.rotulo }}</p>
          <p class="ds-valor">
            {{ formatarMoeda(caixa.resumo.porForma[f.valor]) }}
          </p>
        </div>
        <!-- Cashback abate como desconto: aparece, mas não entra na gaveta
             (planejamento 0037). -->
        <div v-if="caixa.resumo.cashback" class="resumo__forma">
          <p class="ds-rotulo">Cashback usado</p>
          <p class="ds-valor">
            {{ formatarMoeda(caixa.resumo.cashback) }}
          </p>
        </div>
        <!-- Saídas e entradas da gaveta pelo financeiro (planejamento 0027,
             parte 2): contas pagas ou recebidas com dinheiro do caixa. -->
        <div v-if="caixa.resumo.saidas" class="resumo__forma">
          <p class="ds-rotulo">Saídas</p>
          <p class="ds-valor">− {{ formatarMoeda(caixa.resumo.saidas) }}</p>
        </div>
        <div v-if="caixa.resumo.entradas" class="resumo__forma">
          <p class="ds-rotulo">Entradas</p>
          <p class="ds-valor">+ {{ formatarMoeda(caixa.resumo.entradas) }}</p>
        </div>
        <div class="resumo__forma">
          <p class="ds-rotulo">Na gaveta</p>
          <p class="ds-valor">
            {{ formatarMoeda(caixa.resumo.dinheiroEsperado) }}
          </p>
          <p class="ds-corpo-sm ds-suave">
            troco {{ formatarMoeda(caixa.valorInicial) }} + dinheiro{{
              caixa.resumo.saidas || caixa.resumo.entradas
                ? ' ± saídas e entradas'
                : ''
            }}
          </p>
        </div>
      </section>

      <DsTabela
        :colunas="colunas"
        :linhas="comandas"
        texto-vazio="Nenhuma comanda hoje"
        @selecionar="(c) => abrirComanda(c.id)"
      >
        <template #celula-estado="{ valor }">
          <DsSelo :estado="seloDaComanda(valor).estado">{{
            seloDaComanda(valor).texto
          }}</DsSelo>
        </template>
      </DsTabela>
    </template>

    <ComandaDialogo :id="comandaId" v-model="comandaAberta" />
    <FecharCaixa
      v-if="caixa"
      v-model="fechamentoAberto"
      :caixa="caixa"
      @fechado="carregar"
    />
  </DsPagina>
</template>

<style scoped>
.abrir {
  max-width: 28rem;
}
.resumo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--esp-3);
}
.resumo > div {
  display: grid;
  align-content: start;
  gap: var(--esp-1);
  padding: var(--esp-4);
  background: var(--placa);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
}
.resumo p {
  margin: 0;
}
.resumo__total {
  grid-column: span 2;
}
</style>
