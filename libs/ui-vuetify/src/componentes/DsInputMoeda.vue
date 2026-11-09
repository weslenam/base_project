<script setup>
import { centavosParaReais, formatarDecimal } from '@barbertime/ui-utils';
import CampoMascarado from '../internos/CampoMascarado.vue';

/** Modelo: número em reais (45.9). Digita-se como centavos: 4 → 0,04 → 45,90. */
const modelo = defineModel({ type: [Number, null], default: null });

defineProps({
  rotulo: { type: String, default: 'Valor' },
  ajuda: { type: String, default: '' },
  erro: { type: String, default: '' },
  obrigatorio: Boolean,
  desabilitado: Boolean,
});
</script>

<template>
  <CampoMascarado
    v-model="modelo"
    :formatar="formatarDecimal"
    :extrair="centavosParaReais"
    modo-teclado="decimal"
    prefixo="R$"
    dica="0,00"
    :rotulo="rotulo"
    :ajuda="ajuda"
    :erro="erro"
    :obrigatorio="obrigatorio"
    :desabilitado="desabilitado"
  />
</template>
