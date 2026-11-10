<script setup>
import { computed, ref, watch } from 'vue';
import { DsBotao, DsDialogo, DsEscolha, DsSelect } from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import {
  descreverItens,
  descreverLimites,
  descreverPreco,
  descreverVigencia,
} from '../pacotes/descricao.js';

const aberto = defineModel({ type: Boolean, default: false });
/** Renovação (planejamento 0034): o pacote vem fixo; só se escolhe quem vendeu. */
const props = defineProps({ renovacao: { type: Object, default: null } });
const emit = defineEmits(['vender']);

const pacotes = ref([]);
const barbeiros = ref([]);
const pacoteId = ref(null);
const barbeiroId = ref(null);

watch(aberto, async (abriu) => {
  if (!abriu) return;
  pacoteId.value = props.renovacao?.pacoteId ?? null;
  barbeiroId.value = null;
  [pacotes.value, barbeiros.value] = await Promise.all([
    api.pacotes.listar(),
    api.barbeiros.listar(),
  ]);
});

const opcoesPacotes = computed(() =>
  pacotes.value.map((p) => ({
    valor: p.id,
    rotulo: `${p.nome} · ${descreverPreco(p)}`,
  })),
);
const opcoesBarbeiros = computed(() =>
  barbeiros.value.map((b) => ({ valor: b.id, rotulo: b.nome })),
);
const escolhido = computed(() =>
  pacotes.value.find((p) => p.id === pacoteId.value),
);

function confirmar() {
  emit('vender', { pacoteId: pacoteId.value, barbeiroId: barbeiroId.value });
  aberto.value = false;
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="renovacao ? 'Renovar pacote' : 'Vender pacote'"
    largura="md"
    fechavel
  >
    <div class="vender">
      <p v-if="renovacao" class="ds-corpo">
        <strong>{{ escolhido?.nome }}</strong>
        <template v-if="escolhido"> · {{ descreverPreco(escolhido) }}</template>
      </p>
      <DsEscolha
        v-else-if="opcoesPacotes.length <= 4"
        v-model="pacoteId"
        :opcoes="opcoesPacotes"
        rotulo="Pacote"
      />
      <DsSelect
        v-else
        v-model="pacoteId"
        rotulo="Pacote"
        :opcoes="opcoesPacotes"
      />
      <dl v-if="escolhido" class="resumo">
        <div>
          <dt>Serviços</dt>
          <dd>{{ descreverItens(escolhido) }}</dd>
        </div>
        <div>
          <dt>Vigência</dt>
          <dd>{{ descreverVigencia(escolhido) }}</dd>
        </div>
        <div>
          <dt>Uso</dt>
          <dd>{{ descreverLimites(escolhido) }}</dd>
        </div>
      </dl>
      <DsSelect
        v-model="barbeiroId"
        rotulo="Quem vendeu"
        :opcoes="opcoesBarbeiros"
      />
      <p v-if="renovacao" class="ds-corpo-sm ds-suave">
        Abre uma comanda no caixa com a renovação. O novo mês começa
        {{ renovacao.inicio }}, quando a comanda for paga.
      </p>
      <p v-else class="ds-corpo-sm ds-suave">
        Abre uma comanda no caixa com o pacote. Ele passa a valer quando a
        comanda for paga.
      </p>
    </div>
    <template #acoes>
      <DsBotao :desabilitado="!pacoteId || !barbeiroId" @click="confirmar">
        {{
          renovacao ? 'Renovar e ir para o caixa' : 'Vender e ir para o caixa'
        }}
      </DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.vender {
  display: grid;
  gap: var(--esp-3);
}
.vender p {
  margin: 0;
}
.resumo {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
  padding: var(--esp-3);
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
}
.resumo div {
  display: flex;
  gap: var(--esp-2);
}
.resumo dt {
  min-width: 5rem;
  color: var(--grafite-suave);
}
.resumo dd {
  margin: 0;
}
</style>
