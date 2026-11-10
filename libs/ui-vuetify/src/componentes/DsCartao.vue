<script setup lang="ts">
defineProps({
  titulo: { type: String, default: '' },
});
</script>

<template>
  <section class="ds-cartao" :aria-label="titulo || undefined">
    <header
      v-if="titulo || $slots['cabecalho-acoes']"
      class="ds-cartao__cabecalho"
    >
      <h3 v-if="titulo" class="ds-cartao__titulo">{{ titulo }}</h3>
      <div class="ds-cartao__cabecalho-acoes">
        <slot name="cabecalho-acoes" />
      </div>
    </header>
    <div class="ds-cartao__conteudo">
      <slot />
    </div>
    <footer v-if="$slots.acoes" class="ds-cartao__acoes">
      <slot name="acoes" />
    </footer>
  </section>
</template>

<style scoped>
/* Referência: .bt-cartao */
.ds-cartao {
  background: var(--placa);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  box-shadow: var(--sombra-placa);
  color: var(--grafite);
}
.ds-cartao__cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esp-2);
  padding: var(--esp-4) var(--esp-4) 0;
}
.ds-cartao__titulo {
  margin: 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.ds-cartao__conteudo {
  padding: var(--esp-4);
}
.ds-cartao__acoes {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--esp-2);
  padding: 0 var(--esp-4) var(--esp-4);
}
</style>
