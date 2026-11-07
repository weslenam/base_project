<script setup>
import {
  formatarTelefone,
  somenteDigitos,
  validarTelefone,
} from '@barbertime/ui-utils';
import CampoMascarado from '../internos/CampoMascarado.vue';

/** Modelo: só dígitos ('11987654321'). Exibe '(11) 98765-4321'. */
const modelo = defineModel({ type: [String, null], default: null });

defineProps({
  rotulo: { type: String, default: 'Telefone' },
  ajuda: { type: String, default: '' },
  erro: { type: String, default: '' },
  obrigatorio: Boolean,
  desabilitado: Boolean,
  /** false: não acusa número incompleto (ex.: campo de busca). */
  validarNumero: { type: Boolean, default: true },
});

const extrair = (texto) => somenteDigitos(texto).slice(0, 11) || null;
</script>

<template>
  <CampoMascarado
    v-model="modelo"
    :formatar="formatarTelefone"
    :extrair="extrair"
    :validar="validarNumero ? validarTelefone : null"
    mensagem-invalida="Telefone inválido"
    modo-teclado="tel"
    dica="(11) 98765-4321"
    :rotulo="rotulo"
    :ajuda="ajuda"
    :erro="erro"
    :obrigatorio="obrigatorio"
    :desabilitado="desabilitado"
  />
</template>
