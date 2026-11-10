<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInputMoeda,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { diferencaDeCaixa, FORMAS_DE_PAGAMENTO } from '@barbertime/dominio';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ caixa: { type: Object, required: true } });
const emit = defineEmits(['fechado']);

const { advertir } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const contado = ref(null);

watch(aberto, (abriu) => abriu && (contado.value = null));

const resumo = computed(() => props.caixa.resumo);
const diferenca = computed(() =>
  contado.value === null
    ? null
    : diferencaDeCaixa(contado.value, resumo.value.dinheiroEsperado),
);

async function fechar() {
  if (diferenca.value) {
    const tipo = diferenca.value < 0 ? 'Faltam' : 'Sobram';
    const seguir = await advertir(
      `${tipo} ${formatarMoeda(Math.abs(diferenca.value))} no dinheiro (esperado ${formatarMoeda(resumo.value.dinheiroEsperado)}). Conte de novo ou feche assim mesmo; a diferença fica registrada.`,
      { textoOk: 'Fechar com diferença', textoCancelar: 'Contar de novo' },
    );
    if (!seguir) return;
  }
  const fechado = await executar(() =>
    api.caixa.fechar({ dinheiroContado: contado.value }),
  );
  if (!fechado) return;
  notificar.sucesso(
    `Caixa fechado: ${formatarMoeda(fechado.resumo.totalRecebido)} recebidos hoje.`,
  );
  aberto.value = false;
  emit('fechado', fechado);
}
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Fechar caixa" largura="sm">
    <dl class="conferencia">
      <div v-for="f in FORMAS_DE_PAGAMENTO" :key="f.valor">
        <dt>{{ f.rotulo }}</dt>
        <dd class="ds-valor">{{ formatarMoeda(resumo.porForma[f.valor]) }}</dd>
      </div>
      <!-- Cashback: abatido, fora da gaveta (planejamento 0037). -->
      <div v-if="resumo.cashback">
        <dt>Cashback usado (abatido)</dt>
        <dd class="ds-valor">{{ formatarMoeda(resumo.cashback) }}</dd>
      </div>
      <div class="conferencia__total">
        <dt>Total recebido</dt>
        <dd class="ds-valor">{{ formatarMoeda(resumo.totalRecebido) }}</dd>
      </div>
      <!-- Saídas e entradas da gaveta pelo financeiro (planejamento 0027). -->
      <div v-if="resumo.saidas">
        <dt>Saídas da gaveta (contas pagas)</dt>
        <dd class="ds-valor">− {{ formatarMoeda(resumo.saidas) }}</dd>
      </div>
      <div v-if="resumo.entradas">
        <dt>Entradas na gaveta (contas recebidas)</dt>
        <dd class="ds-valor">+ {{ formatarMoeda(resumo.entradas) }}</dd>
      </div>
      <div>
        <dt>Dinheiro esperado na gaveta</dt>
        <dd class="ds-valor">{{ formatarMoeda(resumo.dinheiroEsperado) }}</dd>
      </div>
    </dl>
    <DsFormulario id="form-fechar-caixa" @enviar="fechar">
      <DsInputMoeda
        v-model="contado"
        rotulo="Dinheiro contado na gaveta"
        obrigatorio
      />
    </DsFormulario>
    <p
      v-if="diferenca"
      class="ds-corpo-sm"
      :class="diferenca < 0 ? 'falta' : 'ds-suave'"
    >
      {{ diferenca < 0 ? 'Falta' : 'Sobra' }} de
      {{ formatarMoeda(Math.abs(diferenca)) }}
    </p>
    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Voltar</DsBotao>
      <DsBotao formulario="form-fechar-caixa">Fechar caixa</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.conferencia {
  display: grid;
  gap: var(--esp-1);
  margin: 0 0 var(--esp-4);
}
.conferencia div {
  display: flex;
  justify-content: space-between;
}
.conferencia dt,
.conferencia dd {
  margin: 0;
}
.conferencia__total {
  padding-top: var(--esp-2);
  border-top: 1px solid var(--linha);
  font-weight: 600;
}
.falta {
  color: var(--perigo);
}
</style>
