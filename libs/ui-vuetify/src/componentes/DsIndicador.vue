<script setup>
import { computed } from 'vue';

// Cartão de indicador (KPI): rótulo, valor em destaque, variação e detalhe.
// Feito para grades de painel: o valor nunca vaza do cartão e todos os
// cartões da linha ficam com a mesma altura.
const props = defineProps({
  rotulo: { type: String, required: true },
  /** Já formatado pela tela (ex.: formatarMoeda). */
  valor: { type: [String, Number], required: true },
  /** Texto de apoio abaixo do valor. */
  detalhe: { type: String, default: '' },
  /**
   * Variação percentual contra a referência (ex.: 12.5 = +12,5%).
   * null = sem base para comparar; undefined = não mostra a linha.
   */
  variacao: { type: Number, default: undefined },
  /** Referência da variação (ex.: "mês anterior"). */
  comparacao: { type: String, default: 'período anterior' },
});

const tendencia = computed(() => {
  if (props.variacao === null || props.variacao === undefined) return 'igual';
  return props.variacao > 0 ? 'sobe' : props.variacao < 0 ? 'cai' : 'igual';
});

const textoVariacao = computed(() => {
  const v = props.variacao;
  if (v === null) return `sem base no ${props.comparacao}`;
  const numero = v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${v > 0 ? '+' : ''}${numero}% vs ${props.comparacao}`;
});
</script>

<template>
  <section class="ds-indicador" :aria-label="rotulo">
    <p class="ds-indicador__rotulo">{{ rotulo }}</p>
    <p class="ds-indicador__valor">{{ valor }}</p>
    <p
      v-if="variacao !== undefined"
      :class="[
        'ds-indicador__variacao',
        `ds-indicador__variacao--${tendencia}`,
      ]"
      :data-tendencia="tendencia"
    >
      {{ textoVariacao }}
    </p>
    <p v-if="detalhe" class="ds-indicador__detalhe">{{ detalhe }}</p>
    <slot />
  </section>
</template>

<style scoped>
.ds-indicador {
  display: flex;
  flex-direction: column;
  gap: var(--esp-1);
  min-inline-size: 0;
  block-size: 100%;
  padding: var(--esp-4);
  background: var(--placa);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  box-shadow: var(--sombra-placa);
  color: var(--grafite);
}
.ds-indicador p {
  margin: 0;
}
.ds-indicador__rotulo {
  font: var(--tipo-rotulo);
  letter-spacing: var(--tipo-rotulo-espacamento);
  text-transform: uppercase;
  color: var(--grafite-suave);
}
.ds-indicador__valor {
  margin-block-start: var(--esp-1) !important;
  font: var(--tipo-titulo);
  letter-spacing: var(--tipo-titulo-espacamento);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.ds-indicador__variacao,
.ds-indicador__detalhe {
  font: var(--tipo-corpo-sm);
  color: var(--grafite-suave);
}
.ds-indicador__variacao--sobe {
  color: var(--sucesso);
}
.ds-indicador__variacao--cai {
  color: var(--perigo);
}
</style>
