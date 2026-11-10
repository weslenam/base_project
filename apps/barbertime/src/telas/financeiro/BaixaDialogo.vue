<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputMoeda,
  DsSelect,
  useNotificacao,
} from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { FORMAS_DE_BAIXA, hojeIso } from '@barbertime/dominio';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';

// Baixa de uma conta (planejamento 0027, parte 2): data, valor pago (pode
// diferir do previsto) e forma. "Dinheiro do caixa" sai ou entra na gaveta do
// caixa de hoje, então a data é hoje.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ conta: { type: Object, default: null } });
const emit = defineEmits(['baixada']);

const notificar = useNotificacao();
const executar = useAcao();
const form = ref({});

const receber = computed(() => props.conta?.tipo === 'receber');
const doCaixa = computed(() => form.value.forma === 'dinheiro_caixa');
const opcoes = FORMAS_DE_BAIXA.map((f) => ({
  valor: f.valor,
  rotulo: f.rotulo,
}));

watch(aberto, (abriu) => {
  if (!abriu) return;
  form.value = {
    data: hojeIso(),
    valorPago: props.conta?.valor ?? null,
    forma: null,
  };
});
watch(doCaixa, (sim) => {
  if (sim) form.value.data = hojeIso();
});

async function confirmar() {
  // Dinheiro do caixa: a API usa o dia de hoje da barbearia.
  const dados = doCaixa.value ? { ...form.value, data: null } : form.value;
  const conta = await executar(() =>
    api.financeiro.contas.baixar(props.conta.id, dados),
  );
  if (!conta) return;
  notificar.sucesso(
    doCaixa.value
      ? `${formatarMoeda(conta.valorPago)} ${receber.value ? 'entrou no' : 'saiu do'} caixa de hoje.`
      : receber.value
        ? 'Conta recebida.'
        : 'Conta paga.',
  );
  aberto.value = false;
  emit('baixada', conta);
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="receber ? 'Receber conta' : 'Pagar conta'"
    largura="sm"
  >
    <DsFormulario id="form-baixa" @enviar="confirmar">
      <p class="ds-corpo">
        {{ conta?.descricao }} · previsto {{ formatarMoeda(conta?.valor) }}
      </p>
      <DsSelect
        v-model="form.forma"
        rotulo="Forma de pagamento"
        :opcoes="opcoes"
        obrigatorio
      />
      <DsInput
        v-model="form.data"
        tipo="data"
        :rotulo="receber ? 'Recebido em' : 'Pago em'"
        :desabilitado="doCaixa"
        :ajuda="doCaixa ? 'Com dinheiro do caixa, a data é hoje.' : ''"
        obrigatorio
      />
      <DsInputMoeda
        v-model="form.valorPago"
        :rotulo="receber ? 'Valor recebido' : 'Valor pago'"
        ajuda="Pode ser diferente do previsto (juros ou desconto)."
        obrigatorio
      />
    </DsFormulario>
    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Voltar</DsBotao>
      <DsBotao formulario="form-baixa">
        {{ receber ? 'Confirmar recebimento' : 'Confirmar pagamento' }}
      </DsBotao>
    </template>
  </DsDialogo>
</template>
