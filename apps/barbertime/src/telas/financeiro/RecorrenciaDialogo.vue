<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsEscolha,
  DsFormulario,
  DsInput,
  DsInputMoeda,
  DsSelect,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import type { PropType } from 'vue';
import type { CategoriaFinanceira, RecorrenciaFinanceira } from '@barbertime/contratos';

// Recorrência financeira (planejamento 0027, parte 2, fatia 2B).
const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  recorrencia: {
    type: Object as PropType<RecorrenciaFinanceira | null>,
    default: null,
  },
});
const emit = defineEmits(['alterada']);

const TIPOS = [
  { valor: 'pagar', rotulo: 'A pagar' },
  { valor: 'receber', rotulo: 'A receber' },
];
const DIAS = Array.from({ length: 28 }, (_, i) => ({
  valor: i + 1,
  rotulo: String(i + 1),
}));

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const form = ref({
  id: undefined as number | undefined,
  tipo: 'pagar',
  descricao: '',
  categoriaId: null as number | null,
  valor: 0,
  diaDoMes: 1,
});

const editando = computed(() => Boolean(props.recorrencia?.id));
const categorias = ref<CategoriaFinanceira[]>([]);

const categoriasDoTipo = computed(() =>
  categorias.value
    .filter((c) => c.ativa && c.tipo === form.value.tipo)
    .map((c) => ({ valor: c.id, rotulo: c.nome })),
);

watch(aberto, async (abriu) => {
  if (!abriu) return;
  categorias.value = await api.financeiro.categorias.listar();
  const r = props.recorrencia;
  form.value = {
    id: r?.id,
    tipo: r?.tipo ?? 'pagar',
    descricao: r?.descricao ?? '',
    categoriaId: r?.categoriaId ?? null,
    valor: r?.valor ?? 0,
    diaDoMes: r?.diaDoMes ?? 1,
  };
});

async function salvar() {
  const salva = await executar(() =>
    api.financeiro.recorrencias.salvar(form.value),
  );
  if (!salva) return;
  notificar.sucesso(
    editando.value ? 'Recorrência atualizada.' : 'Recorrência criada.',
  );
  aberto.value = false;
  emit('alterada');
}

async function encerrar() {
  const id = form.value.id;
  if (id === undefined) return;
  const ok = await confirmar(
    `Encerrar a recorrência "${form.value.descricao}"? As contas futuras em aberto serão canceladas.`,
    { perigo: true, textoOk: 'Encerrar', textoCancelar: 'Manter' },
  );
  if (!ok) return;
  const feito = await executar(() =>
    api.financeiro.recorrencias.encerrar(id),
  );
  if (!feito) return;
  notificar.sucesso('Recorrência encerrada.');
  aberto.value = false;
  emit('alterada');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar recorrência' : 'Nova recorrência'"
    largura="sm"
  >
    <DsFormulario id="form-recorrencia" @enviar="salvar">
      <DsEscolha
        v-model="form.tipo"
        :opcoes="TIPOS"
        rotulo="Tipo"
        :desabilitado="editando"
      />
      <DsInput v-model="form.descricao" rotulo="Descrição" obrigatorio />
      <DsSelect
        v-model="form.categoriaId"
        :opcoes="categoriasDoTipo"
        rotulo="Categoria"
        obrigatorio
      />
      <DsInputMoeda v-model="form.valor" rotulo="Valor" obrigatorio />
      <DsSelect
        v-model="form.diaDoMes"
        :opcoes="DIAS"
        rotulo="Dia do mês (1 a 28)"
        obrigatorio
      />
    </DsFormulario>
    <template #acoes>
      <DsBotao
        v-if="editando && !recorrencia?.encerradaEm"
        variante="perigo"
        class="acao-encerrar"
        @click="encerrar"
      >
        Encerrar
      </DsBotao>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao
        formulario="form-recorrencia"
        :desabilitado="Boolean(recorrencia?.encerradaEm)"
      >
        Salvar
      </DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.acao-encerrar {
  margin-inline-end: auto;
}
</style>
