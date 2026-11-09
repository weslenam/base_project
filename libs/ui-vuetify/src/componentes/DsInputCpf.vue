<script setup>
import { formatarCpf, somenteDigitos, validarCpf } from '@barbertime/ui-utils';
import CampoMascarado from '../internos/CampoMascarado.vue';

/** Modelo: só dígitos ('12345678909'). Exibe '123.456.789-09'. */
const modelo = defineModel({ type: [String, null], default: null });

defineProps({
  rotulo: { type: String, default: 'CPF' },
  ajuda: { type: String, default: '' },
  erro: { type: String, default: '' },
  obrigatorio: Boolean,
  desabilitado: Boolean,
});

const extrair = (texto) => somenteDigitos(texto).slice(0, 11) || null;
</script>

<template>
  <CampoMascarado
    v-model="modelo"
    :formatar="formatarCpf"
    :extrair="extrair"
    :validar="validarCpf"
    mensagem-invalida="CPF inválido"
    dica="000.000.000-00"
    :rotulo="rotulo"
    :ajuda="ajuda"
    :erro="erro"
    :obrigatorio="obrigatorio"
    :desabilitado="desabilitado"
  />
</template>
