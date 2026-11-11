<script setup lang="ts">
import { DsIcone } from '@barbertime/ui';

// "O que eu vou poder fazer?" (planejamento 0033): a história do papel em
// linguagem do dia a dia, sem as chaves técnicas das permissões.
defineProps({
  /** historiaDoPapel(): { nome, resumo, pode, naoPode } */
  historia: { type: Object, required: true },
  /** Título da história (ex.: "Como vai ser o dia da Ana como Recepção"). */
  titulo: { type: String, default: '' },
});
</script>

<template>
  <section class="historia" :aria-label="titulo || historia.nome">
    <p v-if="titulo" class="historia__titulo">{{ titulo }}</p>
    <div class="historia__listas">
      <div v-if="historia.pode.length">
        <p class="historia__rotulo">Vai poder</p>
        <ul class="historia__lista">
          <li v-for="acao in historia.pode" :key="acao" class="historia__item">
            <DsIcone nome="check" tamanho="sm" class="historia__pode" />
            <span>{{ acao }}</span>
          </li>
        </ul>
      </div>
      <div v-if="historia.naoPode.length">
        <p class="historia__rotulo">Não vai poder</p>
        <ul class="historia__lista">
          <li
            v-for="acao in historia.naoPode"
            :key="acao"
            class="historia__item"
          >
            <DsIcone nome="fechar" tamanho="sm" class="historia__nao" />
            <span>{{ acao }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.historia {
  display: grid;
  gap: var(--esp-3);
  padding: var(--esp-4);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  background: var(--placa-funda);
}
.historia p {
  margin: 0;
}
.historia__titulo {
  font: var(--tipo-corpo);
  font-weight: 600;
}
.historia__listas {
  display: grid;
  gap: var(--esp-3);
}
.historia__rotulo {
  margin-block-end: var(--esp-1) !important;
  font: var(--tipo-rotulo);
  letter-spacing: var(--tipo-rotulo-espacamento);
  text-transform: uppercase;
  color: var(--grafite-suave);
}
.historia__lista {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.historia__item {
  display: flex;
  align-items: flex-start;
  gap: var(--esp-2);
  font: var(--tipo-corpo-sm);
}
.historia__item :deep(.ds-icone) {
  flex-shrink: 0;
  margin-block-start: 2px;
}
.historia__pode {
  color: var(--sucesso);
}
.historia__nao {
  color: var(--perigo);
}
</style>
