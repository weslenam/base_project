<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsCaixaDeSelecao,
  DsDialogo,
  DsEscolha,
  DsFormulario,
  DsInput,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';

// Categoria do financeiro (planejamento 0027, parte 2). Com conta lançada,
// não se exclui: só se desativa (some da escolha nas contas novas).
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ categoria: { type: Object, default: null } });
const emit = defineEmits(['alterada']);

const TIPOS = [
  { valor: 'pagar', rotulo: 'A pagar' },
  { valor: 'receber', rotulo: 'A receber' },
];
const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const form = ref({});
const editando = computed(() => Boolean(props.categoria?.id));

watch(aberto, (abriu) => {
  if (!abriu) return;
  const c = props.categoria;
  form.value = {
    id: c?.id,
    nome: c?.nome ?? '',
    tipo: c?.tipo ?? 'pagar',
    ativa: c?.ativa ?? true,
  };
});

async function salvar() {
  const salva = await executar(() =>
    api.financeiro.categorias.salvar(form.value),
  );
  if (!salva) return;
  notificar.sucesso(
    editando.value ? 'Categoria atualizada.' : 'Categoria criada.',
  );
  aberto.value = false;
  emit('alterada');
}

async function excluir() {
  const ok = await confirmar(`Excluir a categoria "${form.value.nome}"?`, {
    perigo: true,
    textoOk: 'Excluir',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await api.financeiro.categorias.excluir(form.value.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Categoria excluída.');
  aberto.value = false;
  emit('alterada');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar categoria' : 'Nova categoria'"
    largura="sm"
  >
    <DsFormulario id="form-categoria" @enviar="salvar">
      <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
      <DsEscolha
        v-model="form.tipo"
        :opcoes="TIPOS"
        rotulo="Tipo"
        :desabilitado="editando"
      />
      <DsCaixaDeSelecao
        v-if="editando"
        v-model="form.ativa"
        rotulo="Ativa"
        descricao="Desativada, some da escolha nas contas novas."
      />
    </DsFormulario>
    <template #acoes>
      <DsBotao
        v-if="editando && !categoria.emUso"
        variante="perigo"
        class="acao-excluir"
        @click="excluir"
      >
        Excluir
      </DsBotao>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao formulario="form-categoria">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.acao-excluir {
  margin-inline-end: auto;
}
</style>
