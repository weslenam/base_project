<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputMoeda,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const form = ref({});
const editando = computed(() => Boolean(props.id));

const regraComissao = (v) =>
  (v !== '' && Number(v) >= 0 && Number(v) <= 100) || 'Entre 0 e 100';

watch(aberto, async (abriu) => {
  if (!abriu) return;
  const produtos = await api.produtos.listar();
  const atual = produtos.find((p) => p.id === props.id);
  form.value = atual ? { ...atual } : { nome: '', preco: null, comissao: 10 };
});

async function salvar() {
  const salvo = await executar(() =>
    api.produtos.salvar({
      ...form.value,
      comissao: Number(form.value.comissao),
    }),
  );
  if (!salvo) return;
  notificar.sucesso(
    editando.value ? 'Produto atualizado.' : `${salvo.nome} cadastrado.`,
  );
  aberto.value = false;
  emit('salvo');
}

async function excluir() {
  const ok = await confirmar(`Excluir o produto "${form.value.nome}"?`, {
    perigo: true,
    textoOk: 'Excluir',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await api.produtos.excluir(props.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Produto excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar produto' : 'Novo produto'"
    largura="sm"
  >
    <DsFormulario id="form-produto" @enviar="salvar">
      <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
      <DsInputMoeda v-model="form.preco" rotulo="Preço de venda" obrigatorio />
      <DsInput
        v-model="form.comissao"
        tipo="numero"
        rotulo="Comissão (%)"
        ajuda="Do barbeiro que vender o produto"
        :regras="[regraComissao]"
        obrigatorio
      />
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
      <DsBotao formulario="form-produto">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.acao-excluir {
  margin-inline-end: auto;
}
</style>
