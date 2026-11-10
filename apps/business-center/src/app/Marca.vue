<script setup lang="ts">
import { computed } from 'vue';
import { useTema } from '@barbertime/ui';

// Logo oficial (docs/identidade-visual/logos): negativo no tema escuro. Nunca redesenhar.
const { tema } = useTema();
const arquivo = computed(() =>
  tema.value === 'escuro'
    ? '/barbertime-simbolo-negativo.svg'
    : '/barbertime-simbolo.svg',
);
</script>

<template>
  <img class="marca" :src="arquivo" alt="" width="32" height="32" />
</template>

<style scoped>
.marca {
  display: block;
  width: 32px;
  height: 32px;
}
</style>
