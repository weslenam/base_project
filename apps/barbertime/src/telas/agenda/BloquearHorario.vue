<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PropType } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsSelect,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import type { Barbeiro, Bloqueio } from '../../dados/modelos.ts';
import type { NovoBloqueio } from '../../dados/tipos.ts';

const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  data: { type: String, required: true },
  /** Barbeiro já escolhido (atalho na coluna da agenda). */
  barbeiroId: { type: Number as PropType<number | null>, default: null },
});
const emit = defineEmits<{ criado: [bloqueio: Bloqueio] }>();

const notificar = useNotificacao();
const executar = useAcao();
const barbeiros = ref<Barbeiro[]>([]);
/** O barbeiro pode faltar até a escolha no formulário (obrigatório). */
const form = ref<
  Omit<NovoBloqueio, 'barbeiroId'> & { barbeiroId: number | null }
>({
  barbeiroId: null,
  data: '',
  inicio: '',
  fim: '',
  motivo: '',
});

watch(aberto, async (abriu) => {
  if (!abriu) return;
  form.value = {
    barbeiroId: props.barbeiroId,
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
  const { barbeiroId, ...resto } = form.value;
  if (barbeiroId == null) {
    notificar.aviso('Escolha o barbeiro.');
    return;
  }
  const criado = await executar(() =>
    api.agendamentos.bloquear({ ...resto, barbeiroId }),
  );
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
