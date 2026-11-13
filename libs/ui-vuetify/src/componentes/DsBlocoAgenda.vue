<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import { ROTULOS_DE_ESTADO } from '../internos/estados.ts';
import type { EstadoVisual } from '../internos/estados.ts';

const props = defineProps({
  /** Nome do cliente (ou motivo, quando bloqueado). */
  cliente: { type: String, required: true },
  servico: { type: String, default: '' },
  /** '10:20' */
  inicio: { type: String, default: '' },
  fim: { type: String, default: '' },
  /** confirmado | pendente | assinante | encaixe | bloqueado | atendido | faltou */
  estado: {
    type: String as PropType<EstadoVisual>,
    default: 'pendente',
    validator: (v: string) =>
      [
        'confirmado',
        'pendente',
        'assinante',
        'encaixe',
        'bloqueado',
        'atendido',
        'faltou',
      ].includes(v),
  },
  /** Vira botão e emite `selecionar` ao clicar. */
  clicavel: Boolean,
  /** Indica agendamento feito pelo cliente via página pública (canal externo). */
  externo: Boolean,
});
const emit = defineEmits(['selecionar']);

const horario = computed(() =>
  [props.inicio, props.fim].filter(Boolean).join('–'),
);
const rotuloEstado = computed(() => ROTULOS_DE_ESTADO[props.estado]);
</script>

<template>
  <component
    :is="clicavel ? 'button' : 'div'"
    :type="clicavel ? 'button' : undefined"
    :class="[
      'ds-bloco',
      `ds-bloco--${estado}`,
      { 'ds-bloco--clicavel': clicavel },
    ]"
    @click="clicavel && emit('selecionar')"
  >
    <span
      v-if="externo"
      class="ds-bloco__externo"
      title="Agendado pelo cliente (online)"
      aria-label="Agendamento online"
    />
    <span v-if="horario" class="ds-bloco__hora">{{ horario }}</span>
    <span class="ds-bloco__cliente">{{ cliente }}</span>
    <span v-if="servico" class="ds-bloco__servico">{{ servico }}</span>
    <span class="ds-bloco__estado">{{ rotuloEstado }}</span>
  </component>
</template>

<style scoped>
/* Referência: .bt-bloco */
.ds-bloco {
  /* Contêiner do texto só para leitor de tela (.ds-bloco__estado): sem isto ele
     escapa do quadro com rolagem e alarga a página no celular (ADR 0020). */
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  width: 100%;
  padding: var(--esp-2) var(--esp-3);
  border: 1px solid var(--linha);
  border-top: 4px solid var(--grafite);
  border-radius: var(--raio-sm);
  background: var(--placa);
  color: var(--grafite);
  text-align: left;
  font: var(--tipo-corpo-sm);
}
.ds-bloco--clicavel {
  cursor: pointer;
}
.ds-bloco--clicavel:hover {
  border-color: var(--linha-forte);
}
.ds-bloco__hora {
  font: var(--tipo-hora);
  font-variant-numeric: tabular-nums;
  color: var(--grafite-suave);
}
.ds-bloco__cliente {
  overflow: hidden;
  font: 600 15px/20px var(--font-sans);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-bloco__servico {
  color: var(--grafite-suave);
}
/* O estado vai por texto para leitor de tela; visualmente, pela borda superior. */
.ds-bloco__estado {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.ds-bloco__externo {
  position: absolute;
  top: var(--esp-2);
  right: var(--esp-2);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--aco);
  flex-shrink: 0;
}
.ds-bloco--confirmado {
  border-top-color: var(--sucesso);
}
.ds-bloco--pendente {
  border-top-color: var(--aco);
}
.ds-bloco--assinante {
  border-top-color: var(--cobre);
}
.ds-bloco--encaixe {
  border-top-color: var(--ambar);
}
.ds-bloco--atendido {
  border-top-color: var(--linha-forte);
  color: var(--grafite-suave);
}
.ds-bloco--faltou {
  border-top-color: var(--perigo);
}
.ds-bloco--faltou .ds-bloco__cliente {
  text-decoration: line-through;
}
.ds-bloco--bloqueado {
  background: repeating-linear-gradient(
    -45deg,
    var(--placa-funda) 0 6px,
    var(--concreto) 6px 12px
  );
  border-top-color: var(--linha-forte);
  color: var(--grafite-suave);
}
</style>
