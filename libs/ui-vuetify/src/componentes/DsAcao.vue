<script setup>
import DsIcone from './DsIcone.vue';

defineProps({
  /** Nome do catálogo do DsIcone. */
  icone: { type: String, required: true },
  titulo: { type: String, required: true },
  /** Uma linha dizendo o efeito da ação. */
  descricao: { type: String, default: '' },
  /** primario | secundario | perigo */
  variante: {
    type: String,
    default: 'secundario',
    validator: (v) => ['primario', 'secundario', 'perigo'].includes(v),
  },
  desabilitado: Boolean,
  /** 52px de altura, para painéis com pouco espaço. */
  compacta: Boolean,
});
const emit = defineEmits(['click']);
</script>

<template>
  <button
    type="button"
    :class="[
      'ds-acao',
      `ds-acao--${variante}`,
      { 'ds-acao--compacta': compacta },
    ]"
    :disabled="desabilitado"
    @click="emit('click', $event)"
  >
    <span class="ds-acao__icone"><DsIcone :nome="icone" tamanho="lg" /></span>
    <span class="ds-acao__textos">
      <span class="ds-acao__titulo">{{ titulo }}</span>
      <span v-if="descricao" class="ds-acao__descricao">{{ descricao }}</span>
    </span>
  </button>
</template>

<style scoped>
/* Botão de ação estilo PDV: grande, fácil de acertar no balcão. */
.ds-acao {
  display: flex;
  align-items: center;
  gap: var(--esp-3);
  width: 100%;
  min-height: 64px;
  padding: var(--esp-3) var(--esp-4);
  border: 2px solid var(--linha-forte);
  border-radius: var(--raio-sm);
  background: var(--placa);
  color: var(--grafite);
  text-align: left;
  cursor: pointer;
}
.ds-acao--compacta {
  min-height: 52px;
  padding: var(--esp-2) var(--esp-3);
  gap: var(--esp-2);
}
.ds-acao:hover:not(:disabled) {
  background: var(--placa-funda);
}
.ds-acao__icone {
  display: inline-flex;
  flex-shrink: 0;
}
.ds-acao__textos {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ds-acao__titulo {
  font: var(--tipo-botao);
  letter-spacing: var(--tipo-botao-espacamento);
  text-transform: uppercase;
}
.ds-acao__descricao {
  font: var(--tipo-corpo-sm);
  color: var(--grafite-suave);
}
.ds-acao--primario {
  background: var(--cobre);
  border-color: var(--cobre);
  color: var(--sobre-cobre);
}
.ds-acao--primario:hover:not(:disabled) {
  background: var(--cobre-escuro);
  border-color: var(--cobre-escuro);
}
.ds-acao--primario .ds-acao__descricao {
  color: inherit;
  opacity: 0.85;
}
.ds-acao--perigo {
  border-color: var(--perigo);
  color: var(--perigo);
}
.ds-acao--perigo:hover:not(:disabled) {
  background: var(--perigo-suave);
}
.ds-acao:disabled {
  background: var(--placa-funda);
  border-color: transparent;
  color: var(--grafite-suave);
  cursor: not-allowed;
}
</style>
