<script setup lang="ts">
import type { PropType } from 'vue';
import type { OpcaoDeHorario } from '../tipos.ts';

const modelo = defineModel<string | null>({ default: null });

defineProps({
  /** [{ hora: '09:30', disponivel: true }] */
  opcoes: { type: Array as PropType<OpcaoDeHorario[]>, default: () => [] },
  /** Nome do grupo para leitor de tela. */
  rotulo: { type: String, default: 'Horários' },
  textoVazio: { type: String, default: 'Nenhum horário livre neste dia' },
});
</script>

<template>
  <div
    v-if="opcoes.length"
    class="ds-horarios"
    role="group"
    :aria-label="rotulo"
  >
    <button
      v-for="opcao in opcoes"
      :key="opcao.hora"
      type="button"
      class="ds-horarios__horario"
      :aria-pressed="modelo === opcao.hora ? 'true' : 'false'"
      :disabled="!opcao.disponivel"
      @click="modelo = opcao.hora"
    >
      {{ opcao.hora }}
    </button>
  </div>
  <p v-else class="ds-horarios__vazio">{{ textoVazio }}</p>
</template>

<style scoped>
/* Referência: .bt-horarios / .bt-horario */
.ds-horarios {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: var(--esp-2);
}
.ds-horarios__horario {
  min-height: 44px;
  border: 2px solid var(--linha-forte);
  border-radius: var(--raio-sm);
  background: var(--placa);
  color: var(--grafite);
  font: var(--tipo-hora);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.ds-horarios__horario:hover {
  border-color: var(--cobre);
}
.ds-horarios__horario[aria-pressed='true'] {
  background: var(--cobre);
  border-color: var(--cobre);
  color: var(--sobre-cobre);
}
.ds-horarios__horario:disabled {
  background: var(--placa-funda);
  border-color: transparent;
  color: var(--grafite-suave);
  text-decoration: line-through;
  cursor: not-allowed;
}
.ds-horarios__vazio {
  margin: 0;
  color: var(--grafite-suave);
}
</style>
