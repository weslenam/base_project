<script setup lang="ts">
import { ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { OpcaoDeSelect } from '@barbertime/ui';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsSelect,
  DsTextarea,
} from '@barbertime/ui';

// Toda ação de operador pede motivo, que vai para a auditoria (ADR 0018).
const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  titulo: { type: String, required: true },
  descricao: { type: String, default: '' },
  textoOk: { type: String, default: 'Confirmar' },
  perigo: Boolean,
  /** [{ valor, rotulo }]: quando informado, pede também a pessoa (ex.: novo Dono). */
  pessoas: { type: Array as PropType<OpcaoDeSelect[] | null>, default: null },
  salvando: Boolean,
});
const emit = defineEmits<{
  confirmar: [dados: { motivo: string; usuarioId: number | null }];
}>();

const motivo = ref('');
const pessoa = ref<number | null>(null);
watch(aberto, (abriu) => {
  if (abriu) {
    motivo.value = '';
    pessoa.value = null;
  }
});

const enviar = () =>
  emit('confirmar', { motivo: motivo.value, usuarioId: pessoa.value });
</script>

<template>
  <DsDialogo v-model="aberto" :titulo="titulo" largura="sm" fechavel>
    <p v-if="descricao" class="ds-corpo-sm">{{ descricao }}</p>
    <DsFormulario id="form-acao" @enviar="enviar">
      <DsSelect
        v-if="props.pessoas"
        v-model="pessoa"
        rotulo="Novo Dono"
        :opcoes="props.pessoas"
        obrigatorio
      />
      <DsTextarea
        v-model="motivo"
        rotulo="Motivo"
        ajuda="Fica registrado no histórico da barbearia"
        :max-caracteres="500"
        obrigatorio
      />
    </DsFormulario>
    <template #acoes>
      <DsBotao variante="fantasma" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao
        formulario="form-acao"
        :variante="perigo ? 'perigo' : 'primario'"
        :carregando="salvando"
        >{{ textoOk }}</DsBotao
      >
    </template>
  </DsDialogo>
</template>
