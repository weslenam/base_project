<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import type { Passo } from '../tipos.ts';

/** Indicador de etapas (stepper). A etapa atual vem por v-model (índice a partir de 0). */
const atual = defineModel<number>({ required: true });
const props = defineProps({
  /** [{ rotulo, resumo? }] — resumo aparece sob a etapa concluída */
  passos: { type: Array as PropType<Passo[]>, required: true },
  /** Nome do conjunto para leitor de tela. */
  rotulo: { type: String, default: 'Etapas' },
});

const estado = (i: number) =>
  i < atual.value ? 'concluido' : i === atual.value ? 'atual' : 'futuro';
const textoAtual = computed(
  () =>
    `Etapa ${atual.value + 1} de ${props.passos.length}: ${props.passos[atual.value]?.rotulo ?? ''}`,
);
</script>

<template>
  <nav class="ds-passos" :aria-label="rotulo">
    <ol class="ds-passos__lista">
      <li
        v-for="(p, i) in passos"
        :key="p.rotulo"
        :class="['ds-passos__passo', `ds-passos__passo--${estado(i)}`]"
        :aria-current="i === atual ? 'step' : undefined"
      >
        <button
          v-if="i < atual"
          type="button"
          class="ds-passos__alvo"
          :aria-label="`Voltar para ${p.rotulo}`"
          @click="atual = i"
        >
          <span class="ds-passos__numero">{{ i + 1 }}</span>
          <span class="ds-passos__rotulo">{{ p.rotulo }}</span>
        </button>
        <span v-else class="ds-passos__alvo">
          <span class="ds-passos__numero">{{ i + 1 }}</span>
          <span class="ds-passos__rotulo">{{ p.rotulo }}</span>
        </span>
      </li>
    </ol>
    <p class="ds-passos__atual" aria-live="polite">{{ textoAtual }}</p>
  </nav>
</template>

<style scoped>
.ds-passos__lista {
  display: flex;
  gap: var(--esp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ds-passos__passo {
  flex: 1;
  min-width: 0;
}
.ds-passos__alvo {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
  width: 100%;
  min-height: 44px;
  padding: 0 0 var(--esp-2);
  border: 0;
  border-bottom: 3px solid var(--linha);
  background: transparent;
  color: var(--grafite-suave);
  font: var(--tipo-botao);
  letter-spacing: var(--tipo-botao-espacamento);
  text-align: left;
  text-transform: uppercase;
}
button.ds-passos__alvo {
  cursor: pointer;
}
button.ds-passos__alvo:hover {
  color: var(--grafite);
}
.ds-passos__numero {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
  font: var(--tipo-hora);
}
.ds-passos__rotulo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-passos__passo--concluido .ds-passos__alvo {
  border-bottom-color: var(--cobre);
}
.ds-passos__passo--concluido .ds-passos__numero {
  background: var(--cobre-suave);
  color: var(--cobre);
}
.ds-passos__passo--atual .ds-passos__alvo {
  border-bottom-color: var(--grafite);
  color: var(--grafite);
}
.ds-passos__passo--atual .ds-passos__numero {
  background: var(--grafite);
  color: var(--concreto);
}
/* Só para leitor de tela (no celular vira o texto visível da etapa). */
.ds-passos__atual {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* Celular: só os números; o nome da etapa atual aparece embaixo. */
@media (max-width: 40rem) {
  .ds-passos__rotulo {
    display: none;
  }
  .ds-passos__alvo {
    justify-content: center;
  }
  .ds-passos__atual {
    position: static;
    width: auto;
    height: auto;
    margin: var(--esp-2) 0 0;
    clip-path: none;
    font: var(--tipo-rotulo);
    letter-spacing: var(--tipo-rotulo-espacamento);
    text-transform: uppercase;
    color: var(--grafite-suave);
  }
}
</style>
