<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import type { PropType } from 'vue';
import type { ProdutoEstoque } from '../../dados/modelos.ts';

// Consumo manual (planejamento 0027): uso registrado à mão, com motivo.
const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  produtos: { type: Array as PropType<ProdutoEstoque[]>, default: () => [] },
});
const emit = defineEmits(['salvo']);

const notificar = useNotificacao();
const executar = useAcao();
const form = ref<{
  produtoId: number | null;
  quantidade: string | number;
  motivo: string;
}>({ produtoId: null, quantidade: '', motivo: '' });

const opcoes = computed(() =>
  props.produtos.map((p) => ({
    valor: p.id,
    rotulo: `${p.nome} (${p.unidade})`,
  })),
);
const regraQuantidade = (v: unknown) => Number(v) > 0 || 'Maior que zero';

watch(aberto, (abriu) => {
  if (abriu) form.value = { produtoId: null, quantidade: '', motivo: '' };
});

async function salvar() {
  const salvo = await executar(() =>
    api.estoque.consumir({
      produtoId: form.value.produtoId,
      quantidade: Number(form.value.quantidade),
      motivo: form.value.motivo,
    }),
  );
  if (!salvo) return;
  notificar.sucesso(`Consumo de ${salvo.nome} registrado.`);
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Registrar consumo" largura="sm">
    <DsFormulario id="form-consumo" @enviar="salvar">
      <DsSelect
        v-model="form.produtoId"
        rotulo="Produto"
        :opcoes="opcoes"
        obrigatorio
      />
      <DsInput
        v-model="form.quantidade"
        tipo="numero"
        rotulo="Quantidade"
        :regras="[regraQuantidade]"
        obrigatorio
      />
      <DsInput
        v-model="form.motivo"
        rotulo="Motivo"
        dica="Ex.: uso na limpeza, produto vencido"
        obrigatorio
      />
    </DsFormulario>
    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao formulario="form-consumo">Registrar</DsBotao>
    </template>
  </DsDialogo>
</template>
