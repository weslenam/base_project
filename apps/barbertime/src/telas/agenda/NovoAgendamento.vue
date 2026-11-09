<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsHorarios,
  DsInput,
  DsSelect,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarDiaCurto, formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import BuscaCliente from '../clientes/BuscaCliente.vue';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({
  data: { type: String, required: true },
  /** Barbeiro já escolhido (atalho na coluna da agenda). */
  barbeiroId: { type: Number, default: null },
});
const emit = defineEmits(['criado']);

const { advertir } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const clienteEscolhido = ref(null);
const erroCliente = ref('');
const barbeiros = ref([]);
const servicos = ref([]);
const form = ref(vazio());
const horarios = ref([]);
const erroHorario = ref('');
const salvando = ref(false);

function vazio() {
  return {
    clienteId: null,
    barbeiroId: props.barbeiroId,
    servicoId: null,
    dia: props.data,
    hora: null,
  };
}

watch(aberto, async (abriu) => {
  if (!abriu) return;
  form.value = vazio();
  erroHorario.value = '';
  erroCliente.value = '';
  clienteEscolhido.value = null;
  [barbeiros.value, servicos.value] = await Promise.all([
    api.barbeiros.listar(),
    api.servicos.listar(),
  ]);
});

async function carregarHorarios() {
  const { dia, barbeiroId, servicoId } = form.value;
  form.value.hora = null;
  horarios.value =
    dia && barbeiroId && servicoId
      ? await api.agendamentos.horariosLivres({
          data: dia,
          barbeiroId,
          servicoId,
        })
      : [];
}
watch(
  () => [form.value.dia, form.value.barbeiroId, form.value.servicoId],
  carregarHorarios,
);

const opcoesBarbeiros = computed(() =>
  barbeiros.value.map((b) => ({
    valor: b.id,
    rotulo: `${b.nome} (${b.inicio}–${b.fim})`,
  })),
);
const opcoesServicos = computed(() =>
  servicos.value.map((s) => ({
    valor: s.id,
    rotulo: `${s.nome} · ${s.duracao} min · ${formatarMoeda(s.preco)}`,
  })),
);
const podeMostrarHorarios = computed(
  () => form.value.dia && form.value.barbeiroId && form.value.servicoId,
);

async function agendar() {
  if (!form.value.clienteId) {
    erroCliente.value = 'Ache o cliente pelo telefone ou cadastre um novo.';
    return;
  }
  if (!form.value.hora) {
    erroHorario.value = 'Escolha um horário.';
    return;
  }
  const cliente = clienteEscolhido.value;
  if (cliente?.faltas) {
    const seguir = await advertir(
      `${cliente.nome} faltou ${cliente.faltas} ${cliente.faltas > 1 ? 'vezes' : 'vez'} recentemente. Agendar mesmo assim?`,
      { textoOk: 'Agendar mesmo assim' },
    );
    if (!seguir) return;
  }
  salvando.value = true;
  const criado = await executar(() =>
    api.agendamentos.criar({
      data: form.value.dia,
      inicio: form.value.hora,
      barbeiroId: form.value.barbeiroId,
      servicoId: form.value.servicoId,
      clienteId: form.value.clienteId,
    }),
  );
  salvando.value = false;
  if (!criado) {
    await carregarHorarios();
    return;
  }
  notificar.sucesso(
    `${criado.clienteNome} agendado para ${formatarDiaCurto(criado.data)} às ${criado.inicio}.`,
  );
  aberto.value = false;
  emit('criado', criado);
}

watch(
  () => form.value.hora,
  (h) => h && (erroHorario.value = ''),
);
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Novo agendamento" largura="md">
    <DsFormulario id="form-novo-agendamento" @enviar="agendar">
      <BuscaCliente
        v-model="form.clienteId"
        @selecionado="(c) => ((clienteEscolhido = c), (erroCliente = ''))"
      />
      <p v-if="erroCliente" class="erro" role="alert">{{ erroCliente }}</p>
      <DsSelect
        v-model="form.servicoId"
        rotulo="Serviço"
        :opcoes="opcoesServicos"
        obrigatorio
      />
      <DsSelect
        v-model="form.barbeiroId"
        rotulo="Barbeiro"
        :opcoes="opcoesBarbeiros"
        obrigatorio
      />
      <DsInput v-model="form.dia" tipo="data" rotulo="Dia" obrigatorio />

      <div v-if="podeMostrarHorarios" class="horarios">
        <p class="ds-rotulo">Horário</p>
        <DsHorarios
          v-model="form.hora"
          :opcoes="horarios"
          rotulo="Horários livres"
        />
        <p v-if="erroHorario" class="horarios__erro" role="alert">
          {{ erroHorario }}
        </p>
      </div>
      <p v-else class="ds-corpo-sm ds-suave">
        Escolha serviço, barbeiro e dia para ver os horários.
      </p>
    </DsFormulario>

    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao formulario="form-novo-agendamento" :carregando="salvando"
        >Agendar</DsBotao
      >
    </template>
  </DsDialogo>
</template>

<style scoped>
.horarios {
  display: grid;
  gap: var(--esp-2);
}
.horarios .ds-rotulo {
  margin: 0;
}
.erro,
.horarios__erro {
  margin: 0;
  color: var(--perigo);
  font: var(--tipo-corpo-sm);
}
</style>
