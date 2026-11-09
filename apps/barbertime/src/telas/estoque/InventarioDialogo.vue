<script setup>
import { ref, watch } from 'vue';
import { DsBotao, DsDialogo, DsInput, useNotificacao } from '@barbertime/ui';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { formatarQuantidade } from './rotulos.js';

// Inventário (planejamento 0027): a contagem física define o saldo novo, e
// cada diferença vira um ajuste. Linha em branco não entra.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ produtos: { type: Array, default: () => [] } });
const emit = defineEmits(['salvo']);

const notificar = useNotificacao();
const executar = useAcao();
const contagem = ref({});

watch(aberto, (abriu) => {
  if (abriu) contagem.value = {};
});

async function salvar() {
  const itens = Object.entries(contagem.value)
    .filter(([, v]) => v !== '' && v != null)
    .map(([produtoId, contado]) => ({
      produtoId: Number(produtoId),
      contado: Number(contado),
    }));
  const r = await executar(() => api.estoque.inventario(itens));
  if (!r) return;
  const n = r.ajustes.length;
  notificar.sucesso(
    n
      ? `Inventário salvo: ${n} ajuste${n > 1 ? 's' : ''}.`
      : 'Inventário salvo: nenhum saldo mudou.',
  );
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Inventário" largura="md" fechavel>
    <p class="ds-corpo-sm ds-suave">
      Informe a quantidade contada de cada produto. Deixe em branco o que não
      foi contado.
    </p>
    <ul class="inventario" aria-label="Contagem">
      <li v-for="p in produtos" :key="p.id" class="inventario__linha">
        <span>
          <strong>{{ p.nome }}</strong>
          <span class="ds-corpo-sm ds-suave">
            · saldo {{ formatarQuantidade(p.saldo, p.unidade) }}
          </span>
        </span>
        <DsInput
          v-model="contagem[p.id]"
          tipo="numero"
          :rotulo="`Contado de ${p.nome}`"
        />
      </li>
    </ul>
    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao @click="salvar">Salvar inventário</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.inventario {
  display: grid;
  gap: var(--esp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.inventario__linha {
  display: grid;
  grid-template-columns: 1fr minmax(8rem, 12rem);
  align-items: center;
  gap: var(--esp-3);
}
@media (max-width: 40rem) {
  .inventario__linha {
    grid-template-columns: 1fr;
  }
}
</style>
