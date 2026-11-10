<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputTelefone,
  DsTextarea,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { documentoValido } from '@barbertime/dominio';
import { somenteDigitos } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ fornecedor: { type: Object, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const form = ref({});
const editando = computed(() => Boolean(props.fornecedor?.id));

const regraDocumento = (v) =>
  documentoValido(somenteDigitos(v ?? '')) || 'CPF ou CNPJ inválido';

watch(aberto, (abriu) => {
  if (!abriu) return;
  const f = props.fornecedor;
  form.value = {
    id: f?.id,
    nome: f?.nome ?? '',
    documento: f?.documento ?? '',
    telefone: f?.telefone ?? null,
    observacoes: f?.observacoes ?? '',
  };
});

async function salvar() {
  const salvo = await executar(() => api.fornecedores.salvar(form.value));
  if (!salvo) return;
  notificar.sucesso(
    editando.value ? 'Fornecedor atualizado.' : `${salvo.nome} cadastrado.`,
  );
  aberto.value = false;
  emit('salvo');
}

async function excluir() {
  const ok = await confirmar(`Excluir o fornecedor "${form.value.nome}"?`, {
    perigo: true,
    textoOk: 'Excluir',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await api.fornecedores.excluir(form.value.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Fornecedor excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar fornecedor' : 'Novo fornecedor'"
    largura="sm"
  >
    <DsFormulario id="form-fornecedor" @enviar="salvar">
      <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
      <DsInput
        v-model="form.documento"
        rotulo="CPF ou CNPJ"
        ajuda="Opcional"
        :regras="[regraDocumento]"
      />
      <DsInputTelefone
        v-model="form.telefone"
        rotulo="Telefone"
        :validar-numero="false"
      />
      <DsTextarea v-model="form.observacoes" rotulo="Observações" />
    </DsFormulario>
    <template #acoes>
      <DsBotao
        v-if="editando"
        variante="perigo"
        class="acao-excluir"
        @click="excluir"
      >
        Excluir
      </DsBotao>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao formulario="form-fornecedor">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.acao-excluir {
  margin-inline-end: auto;
}
</style>
