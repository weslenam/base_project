<script setup>
import { useId } from 'vue';

/** Valor da aba ativa. */
const ativa = defineModel({ type: [String, Number], required: true });

const props = defineProps({
  /** [{ valor, rotulo }] */
  abas: { type: Array, required: true },
  /** Nome do grupo de abas para leitor de tela. */
  rotulo: { type: String, default: '' },
});

const base = useId();
const idAba = (valor) => `${base}-aba-${valor}`;
const idPainel = (valor) => `${base}-painel-${valor}`;

/** Setas, Home e End movem entre abas (padrão WAI-ARIA de tabs). */
function aoTeclar(evento, indice) {
  const total = props.abas.length;
  const destino = {
    ArrowRight: (indice + 1) % total,
    ArrowLeft: (indice - 1 + total) % total,
    Home: 0,
    End: total - 1,
  }[evento.key];
  if (destino === undefined) return;
  evento.preventDefault();
  ativa.value = props.abas[destino].valor;
  document.getElementById(idAba(ativa.value))?.focus();
}
</script>

<template>
  <div class="ds-abas">
    <div
      class="ds-abas__lista"
      role="tablist"
      :aria-label="rotulo || undefined"
    >
      <button
        v-for="(aba, indice) in abas"
        :id="idAba(aba.valor)"
        :key="aba.valor"
        type="button"
        role="tab"
        class="ds-abas__aba"
        :aria-selected="ativa === aba.valor ? 'true' : 'false'"
        :aria-controls="idPainel(aba.valor)"
        :tabindex="ativa === aba.valor ? 0 : -1"
        @click="ativa = aba.valor"
        @keydown="aoTeclar($event, indice)"
      >
        {{ aba.rotulo }}
      </button>
    </div>
    <div
      v-for="aba in abas"
      v-show="ativa === aba.valor"
      :id="idPainel(aba.valor)"
      :key="aba.valor"
      role="tabpanel"
      class="ds-abas__painel"
      :aria-labelledby="idAba(aba.valor)"
      tabindex="0"
    >
      <slot :name="aba.valor" />
    </div>
  </div>
</template>

<style scoped>
.ds-abas__lista {
  display: flex;
  gap: var(--esp-1);
  border-bottom: 2px solid var(--linha);
}
.ds-abas__aba {
  min-height: 44px;
  margin-bottom: -2px;
  padding: 0 var(--esp-4);
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--grafite-suave);
  font: var(--tipo-botao);
  letter-spacing: var(--tipo-botao-espacamento);
  text-transform: uppercase;
  cursor: pointer;
}
.ds-abas__aba:hover {
  color: var(--grafite);
}
.ds-abas__aba[aria-selected='true'] {
  border-bottom-color: var(--cobre);
  color: var(--grafite);
}
.ds-abas__painel {
  padding-top: var(--esp-3);
}
.ds-abas__painel:focus-visible {
  outline-offset: 4px;
}
</style>
