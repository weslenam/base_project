<script setup>
defineProps({
  titulo: { type: String, required: true },
  /** Linha pequena acima do título (ex.: data, contexto). */
  sobretitulo: { type: String, default: '' },
});
</script>

<template>
  <section class="ds-pagina">
    <header class="ds-pagina__cabecalho">
      <div class="ds-pagina__titulos">
        <p v-if="sobretitulo" class="ds-pagina__sobretitulo">
          {{ sobretitulo }}
        </p>
        <h1 class="ds-pagina__titulo">{{ titulo }}</h1>
      </div>
      <div v-if="$slots.acoes" class="ds-pagina__acoes">
        <slot name="acoes" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.ds-pagina {
  display: grid;
  /* Coluna que encolhe: conteúdo largo (tabelas) rola dentro dele mesmo em vez
     de alargar a página no celular (ADR 0020). */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--esp-4);
  /* Ocupa a largura disponível (planejamento 0018): agenda e caixa usam tudo;
     formulários limitam a própria largura. */
  width: 100%;
  box-sizing: border-box;
  padding: var(--esp-6) var(--esp-4);
}
.ds-pagina__cabecalho {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--esp-3);
}
.ds-pagina__sobretitulo {
  margin: 0 0 var(--esp-1);
  font: var(--tipo-rotulo);
  letter-spacing: var(--tipo-rotulo-espacamento);
  text-transform: uppercase;
  color: var(--grafite-suave);
}
.ds-pagina__titulo {
  margin: 0;
  font: var(--tipo-titulo);
  letter-spacing: var(--tipo-titulo-espacamento);
  text-transform: uppercase;
}
.ds-pagina__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--esp-2);
}
</style>
