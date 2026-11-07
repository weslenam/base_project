<script setup>
import { formatarData } from '@barbertime/ui-utils';

const hoje = formatarData(new Date());
</script>

<template>
  <section class="pagina">
    <p class="ds-rotulo">Hoje, {{ hoje }}</p>
    <h1 class="ds-titulo">Agenda de hoje</h1>
    <p class="ds-corpo-lg ds-suave">
      Workspace pronto. As telas do MVP entram aqui conforme o roadmap.
    </p>
  </section>
</template>

<style scoped>
.pagina {
  display: grid;
  gap: var(--esp-2);
  padding: var(--esp-6) var(--esp-4);
}
</style>
