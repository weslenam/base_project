<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputMoeda,
  DsSelect,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar, advertir } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const form = ref({});
const original = ref(null);
const editando = computed(() => Boolean(props.id));
const duracoes = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120].map((m) => ({
  valor: m,
  rotulo: `${m} min`,
}));

watch(aberto, async (abriu) => {
  if (!abriu) return;
  const servicos = await api.servicos.listar();
  original.value = servicos.find((s) => s.id === props.id) ?? null;
  form.value = original.value
    ? { ...original.value }
    : { nome: '', duracao: 30, preco: null };
});

async function salvar() {
  if (editando.value && form.value.duracao !== original.value.duracao) {
    const futuros = await api.servicos.contarFuturos(props.id);
    if (futuros) {
      const seguir = await advertir(
        `Há ${futuros} agendamento${futuros > 1 ? 's' : ''} futuro${futuros > 1 ? 's' : ''} de "${original.value.nome}". A nova duração vale só para os próximos; os já marcados continuam como estão.`,
      );
      if (!seguir) return;
    }
  }
  const salvo = await executar(() => api.servicos.salvar(form.value));
  if (!salvo) return;
  notificar.sucesso(
    editando.value ? 'Serviço atualizado.' : `${salvo.nome} cadastrado.`,
  );
  aberto.value = false;
  emit('salvo');
}

async function excluir() {
  const ok = await confirmar(`Excluir o serviço "${form.value.nome}"?`, {
    perigo: true,
    textoOk: 'Excluir',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await api.servicos.excluir(props.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Serviço excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar serviço' : 'Novo serviço'"
    largura="sm"
  >
    <DsFormulario id="form-servico" @enviar="salvar">
      <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
      <DsSelect
        v-model="form.duracao"
        rotulo="Duração"
        :opcoes="duracoes"
        obrigatorio
      />
      <DsInputMoeda v-model="form.preco" rotulo="Preço" obrigatorio />
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
      <DsBotao formulario="form-servico">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.acao-excluir {
  margin-inline-end: auto;
}
</style>
