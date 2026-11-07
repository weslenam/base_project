<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsSelect,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ data: { type: String, required: true } });
const emit = defineEmits(['criado']);

const notificar = useNotificacao();
const executar = useAcao();
const barbeiros = ref([]);
const form = ref({});

watch(aberto, async (abriu) => {
  if (!abriu) return;
  form.value = {
    barbeiroId: null,
    data: props.data,
    inicio: '12:00',
    fim: '13:00',
    motivo: 'Almoço',
  };
  barbeiros.value = await api.barbeiros.listar();
});

const opcoes = computed(() =>
  barbeiros.value.map((b) => ({ valor: b.id, rotulo: b.nome })),
);

async function bloquear() {
  const criado = await executar(() => api.agendamentos.bloquear(form.value));
  if (!criado) return;
  notificar.sucesso(`Horário bloqueado para ${criado.barbeiroNome}.`);
  aberto.value = false;
  emit('criado', criado);
}
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Bloquear horário" largura="sm">
    <DsFormulario id="form-bloqueio" @enviar="bloquear">
      <DsSelect
        v-model="form.barbeiroId"
        rotulo="Barbeiro"
        :opcoes="opcoes"
        obrigatorio
      />
      <DsInput v-model="form.data" tipo="data" rotulo="Dia" obrigatorio />
      <div class="horas">
        <DsInput
          v-model="form.inicio"
          tipo="hora"
          rotulo="Início"
          obrigatorio
        />
        <DsInput v-model="form.fim" tipo="hora" rotulo="Fim" obrigatorio />
      </div>
      <DsInput
        v-model="form.motivo"
        rotulo="Motivo"
        dica="Almoço, folga, curso..."
      />
    </DsFormulario>
    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao formulario="form-bloqueio">Bloquear</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.horas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--esp-3);
}
</style>
