<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputMoeda,
  DsSelect,
  DsSelo,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { useSessao } from '../../sessao/sessao.js';
import { ROTULO_DA_FORMA, seloDaSituacao } from './rotulos.js';
import BaixaDialogo from './BaixaDialogo.vue';

// Conta a pagar ou a receber (planejamento 0027, parte 2, fatia 2A): lançar,
// editar a aberta (parcela de compra só muda o vencimento), dar baixa,
// estornar e cancelar.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({
  conta: { type: Object, default: null },
  /** Tipo da conta nova (aba atual da tela). */
  tipo: { type: String, default: 'pagar' },
});
const emit = defineEmits(['alterada']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const { moduloAtivo } = useSessao();

const form = ref({});
const atual = ref(null);
const categorias = ref([]);
const fornecedores = ref([]);
const baixaAberta = ref(false);

const nova = computed(() => !atual.value);
const tipoDaConta = computed(() => atual.value?.tipo ?? props.tipo);
const editavel = computed(
  () => nova.value || atual.value.situacao === 'aberta',
);
const daCompra = computed(() => atual.value?.origem === 'compra');
const titulo = computed(() => {
  if (nova.value)
    return tipoDaConta.value === 'pagar'
      ? 'Nova conta a pagar'
      : 'Nova conta a receber';
  return atual.value.descricao;
});

const opcoesCategorias = computed(() =>
  categorias.value
    .filter(
      (c) =>
        c.tipo === tipoDaConta.value &&
        (c.ativa || c.id === atual.value?.categoriaId),
    )
    .map((c) => ({ valor: c.id, rotulo: c.nome })),
);
const opcoesFornecedores = computed(() =>
  fornecedores.value.map((f) => ({ valor: f.id, rotulo: f.nome })),
);
// Fornecedor só a pagar e com o módulo de estoque (o cadastro fica lá).
const comFornecedor = computed(
  () =>
    tipoDaConta.value === 'pagar' && moduloAtivo('estoque') && !daCompra.value,
);

watch(aberto, async (abriu) => {
  if (!abriu) return;
  atual.value = props.conta ? { ...props.conta } : null;
  preencher();
  [categorias.value, fornecedores.value] = await Promise.all([
    api.financeiro.categorias.listar(),
    comFornecedor.value ? api.fornecedores.listar() : [],
  ]);
});

function preencher() {
  const c = atual.value;
  form.value = {
    id: c?.id,
    tipo: tipoDaConta.value,
    descricao: c?.descricao ?? '',
    categoriaId: c?.categoriaId ?? null,
    valor: c?.valor ?? null,
    vencimento: c?.vencimento ?? '',
    fornecedorId: c?.fornecedorId ?? null,
    clienteId: c?.clienteId ?? null,
  };
}

async function salvar() {
  const salva = await executar(() => api.financeiro.contas.salvar(form.value));
  if (!salva) return;
  notificar.sucesso(nova.value ? 'Conta lançada.' : 'Conta atualizada.');
  aberto.value = false;
  emit('alterada');
}

async function cancelar() {
  const ok = await confirmar(`Cancelar a conta "${atual.value.descricao}"?`, {
    perigo: true,
    textoOk: 'Cancelar conta',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const r = await executar(() =>
    api.financeiro.contas.cancelar(atual.value.id),
  );
  if (!r) return;
  notificar.sucesso('Conta cancelada.');
  aberto.value = false;
  emit('alterada');
}

async function estornar() {
  const ok = await confirmar(
    atual.value.forma === 'dinheiro_caixa'
      ? 'Estornar o pagamento? O valor volta para o caixa em que saiu (só se ele ainda estiver aberto).'
      : 'Estornar o pagamento? A conta volta a ficar em aberto.',
    { textoOk: 'Estornar', textoCancelar: 'Manter' },
  );
  if (!ok) return;
  const r = await executar(() =>
    api.financeiro.contas.estornar(atual.value.id),
  );
  if (!r) return;
  notificar.sucesso('Pagamento estornado.');
  atual.value = r;
  preencher();
  emit('alterada');
}

function baixada(conta) {
  atual.value = conta;
  aberto.value = false;
  emit('alterada');
}
</script>

<template>
  <DsDialogo v-model="aberto" :titulo="titulo" largura="sm" fechavel>
    <div v-if="atual" class="conta__situacao">
      <DsSelo :estado="seloDaSituacao(atual.situacaoAtual, atual.tipo).estado">
        {{ seloDaSituacao(atual.situacaoAtual, atual.tipo).texto }}
      </DsSelo>
      <span v-if="daCompra" class="ds-corpo-sm ds-suave">
        Parcela {{ atual.parcela }}/{{ atual.parcelas }} de compra
        {{ atual.fornecedorNome ? `(${atual.fornecedorNome})` : '' }}
      </span>
    </div>

    <dl v-if="atual?.situacao === 'quitada'" class="conta__baixa">
      <div>
        <dt>{{ atual.tipo === 'receber' ? 'Recebido em' : 'Pago em' }}</dt>
        <dd>{{ formatarData(atual.pagoEm) }}</dd>
      </div>
      <div>
        <dt>Valor</dt>
        <dd>{{ formatarMoeda(atual.valorPago) }}</dd>
      </div>
      <div>
        <dt>Forma</dt>
        <dd>{{ ROTULO_DA_FORMA[atual.forma] ?? atual.forma }}</dd>
      </div>
    </dl>

    <DsFormulario v-if="editavel" id="form-conta" @enviar="salvar">
      <template v-if="!daCompra">
        <DsInput v-model="form.descricao" rotulo="Descrição" obrigatorio />
        <DsSelect
          v-model="form.categoriaId"
          rotulo="Categoria"
          :opcoes="opcoesCategorias"
          obrigatorio
        />
        <DsInputMoeda v-model="form.valor" rotulo="Valor" obrigatorio />
      </template>
      <p v-else class="ds-corpo">
        {{ atual.categoriaNome }} · {{ formatarMoeda(atual.valor) }}
      </p>
      <DsInput
        v-model="form.vencimento"
        tipo="data"
        rotulo="Vencimento"
        obrigatorio
      />
      <DsSelect
        v-if="comFornecedor"
        v-model="form.fornecedorId"
        rotulo="Fornecedor (opcional)"
        :opcoes="opcoesFornecedores"
        limpavel
      />
    </DsFormulario>
    <dl v-else class="conta__baixa">
      <div>
        <dt>Categoria</dt>
        <dd>{{ atual.categoriaNome }}</dd>
      </div>
      <div>
        <dt>Vencimento</dt>
        <dd>{{ formatarData(atual.vencimento) }}</dd>
      </div>
      <div>
        <dt>Valor previsto</dt>
        <dd>{{ formatarMoeda(atual.valor) }}</dd>
      </div>
    </dl>

    <template #acoes>
      <DsBotao
        v-if="atual?.situacao === 'aberta' && !daCompra"
        variante="perigo"
        class="conta__cancelar"
        @click="cancelar"
      >
        Cancelar conta
      </DsBotao>
      <DsBotao
        v-if="atual?.situacao === 'quitada'"
        variante="secundario"
        @click="estornar"
      >
        Estornar
      </DsBotao>
      <DsBotao
        v-if="atual?.situacao === 'aberta'"
        variante="secundario"
        @click="baixaAberta = true"
      >
        {{ atual.tipo === 'receber' ? 'Receber' : 'Pagar' }}
      </DsBotao>
      <DsBotao v-if="editavel" formulario="form-conta">
        {{ nova ? 'Lançar' : 'Salvar' }}
      </DsBotao>
    </template>

    <BaixaDialogo v-model="baixaAberta" :conta="atual" @baixada="baixada" />
  </DsDialogo>
</template>

<style scoped>
.conta__cancelar {
  margin-inline-end: auto;
}
.conta__situacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-2);
  margin-bottom: var(--esp-3);
}
.conta__baixa {
  display: grid;
  gap: var(--esp-1);
  margin: 0 0 var(--esp-3);
  padding: var(--esp-3);
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
}
.conta__baixa div {
  display: flex;
  gap: var(--esp-2);
}
.conta__baixa dt {
  min-width: 7rem;
  color: var(--grafite-suave);
}
.conta__baixa dd {
  margin: 0;
}
</style>
