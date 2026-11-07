<script setup>
import { formatarData } from '@barbertime/ui-utils';

const hoje = formatarData(new Date());
</script>

<template>
  <main class="inicio">
    <h1>BarberTime</h1>
    <p>Workspace pronto. Hoje é {{ hoje }}.</p>
  </main>
</template>

<style scoped>
.inicio {
  padding: var(--ds-espaco-lg);
}
</style>
