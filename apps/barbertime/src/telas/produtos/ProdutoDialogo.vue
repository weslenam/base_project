<script setup>
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
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { moduloAtivo } from '../../sessao/sessao.js';
import { TIPOS, UNIDADES } from '../estoque/rotulos.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const form = ref({});
const editando = computed(() => Boolean(props.id));
const revenda = computed(() => form.value.tipo !== 'consumivel');
const comEstoque = computed(() => moduloAtivo('estoque'));

const regraMinimo = (v) =>
  v === '' || v == null || Number(v) >= 0 || 'Não pode ser negativo';
const regraComissao = (v) =>
  (v !== '' && Number(v) >= 0 && Number(v) <= 100) || 'Entre 0 e 100';

watch(aberto, async (abriu) => {
  if (!abriu) return;
  const produtos = await api.produtos.listar();
  const atual = produtos.find((p) => p.id === props.id);
  form.value = atual
    ? { tipo: 'revenda', unidade: 'un', estoqueMinimo: 0, ...atual }
    : {
        nome: '',
        tipo: 'revenda',
        unidade: 'un',
        estoqueMinimo: 0,
        preco: null,
        comissao: 10,
      };
});

async function salvar() {
  const salvo = await executar(() =>
    api.produtos.salvar({
      ...form.value,
      preco: revenda.value ? form.value.preco : null,
      comissao: revenda.value ? Number(form.value.comissao) : 0,
      estoqueMinimo: Number(form.value.estoqueMinimo || 0),
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
      <p class="ds-rotulo">Tipo</p>
      <DsEscolha v-model="form.tipo" :opcoes="TIPOS" rotulo="Tipo do produto" />
      <template v-if="revenda">
        <DsInputMoeda
          v-model="form.preco"
          rotulo="Preço de venda"
          obrigatorio
        />
        <DsInput
          v-model="form.comissao"
          tipo="numero"
          rotulo="Comissão (%)"
          ajuda="Do barbeiro que vender o produto"
          :regras="[regraComissao]"
          obrigatorio
        />
      </template>
      <p v-else class="ds-corpo-sm ds-suave">
        Uso interno: sem preço de venda e fora da comanda.
      </p>
      <DsSelect
        v-model="form.unidade"
        rotulo="Unidade"
        :opcoes="UNIDADES"
        obrigatorio
      />
      <DsInput
        v-if="comEstoque"
        v-model="form.estoqueMinimo"
        tipo="numero"
        rotulo="Estoque mínimo"
        ajuda="Com o saldo neste valor ou abaixo, o produto entra em “Comprar”"
        :regras="[regraMinimo]"
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
.ds-rotulo {
  margin: 0;
}
</style>
