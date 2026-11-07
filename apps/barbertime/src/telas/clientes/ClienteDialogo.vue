<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputCpf,
  DsInputTelefone,
  DsSelo,
  DsTextarea,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarDiaCurto } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { seloDoEstado } from '../estados.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const form = ref({});
const historico = ref([]);
const salvando = ref(false);
const editando = computed(() => Boolean(props.id));

watch(aberto, async (abriu) => {
  if (!abriu) return;
  historico.value = [];
  if (props.id) {
    const [cliente, passados] = await Promise.all([
      api.clientes.obter(props.id),
      api.clientes.historico(props.id),
    ]);
    form.value = cliente;
    historico.value = passados;
  } else {
    form.value = { nome: '', telefone: null, cpf: null, observacoes: '' };
  }
});

async function salvar() {
  salvando.value = true;
  const salvo = await executar(() => api.clientes.salvar(form.value));
  salvando.value = false;
  if (!salvo) return;
  notificar.sucesso(
    editando.value ? 'Cadastro atualizado.' : `${salvo.nome} cadastrado.`,
  );
  aberto.value = false;
  emit('salvo', salvo);
}

async function excluir() {
  const ok = await confirmar(
    `Excluir ${form.value.nome}? O histórico de atendimentos também sai do cadastro.`,
    {
      titulo: 'Excluir cliente',
      perigo: true,
      textoOk: 'Excluir',
      textoCancelar: 'Manter',
    },
  );
  if (!ok) return;
  const feito = await executar(
    async () => (await api.clientes.excluir(props.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Cliente excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar cliente' : 'Novo cliente'"
    largura="md"
  >
    <DsFormulario id="form-cliente" @enviar="salvar">
      <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
      <div class="dupla">
        <DsInputTelefone v-model="form.telefone" obrigatorio />
        <DsInputCpf v-model="form.cpf" ajuda="Opcional, para nota fiscal" />
      </div>
      <DsTextarea
        v-model="form.observacoes"
        rotulo="Observações"
        dica="Preferências, alergias, como gosta do corte..."
        :max-caracteres="500"
      />
    </DsFormulario>

    <section v-if="editando" class="historico" aria-label="Histórico">
      <h4 class="ds-rotulo">Histórico</h4>
      <ul v-if="historico.length" class="historico__lista">
        <li v-for="a in historico" :key="a.id" class="historico__item">
          <span class="ds-hora"
            >{{ formatarDiaCurto(a.data) }} {{ a.inicio }}</span
          >
          <span>{{ a.servicoNome }} · {{ a.barbeiroNome }}</span>
          <DsSelo :estado="seloDoEstado(a.estado).estado">{{
            seloDoEstado(a.estado).texto
          }}</DsSelo>
        </li>
      </ul>
      <p v-else class="ds-corpo-sm ds-suave">Nenhum atendimento ainda.</p>
    </section>

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
      <DsBotao formulario="form-cliente" :carregando="salvando">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.dupla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--esp-3);
}
.historico {
  display: grid;
  gap: var(--esp-2);
  margin-top: var(--esp-4);
  padding-top: var(--esp-4);
  border-top: 1px solid var(--linha);
}
.historico .ds-rotulo {
  margin: 0;
}
.historico__lista {
  display: grid;
  gap: var(--esp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.historico__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-2) var(--esp-3);
}
.acao-excluir {
  margin-inline-end: auto;
}
</style>
