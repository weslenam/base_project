<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { DsBotao, DsSelo, useNotificacao } from '@barbertime/ui';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { useSessao } from '../../sessao/sessao.js';
import VenderPacoteDialogo from './VenderPacoteDialogo.vue';

/** Saldo de fidelidade e pacotes do cliente (planejamento 0015). */
const props = defineProps({ clienteId: { type: Number, required: true } });
const emit = defineEmits(['vendido']);

const { moduloAtivo, pode } = useSessao();
const router = useRouter();
const notificar = useNotificacao();
const executar = useAcao();

const saldo = ref(null);
const assinaturas = ref([]);
const venderAberto = ref(false);

const comFidelidade = computed(() => moduloAtivo('fidelidade'));
const comPacotes = computed(() => moduloAtivo('pacotes'));

async function carregar() {
  [saldo.value, assinaturas.value] = await Promise.all([
    comFidelidade.value ? api.fidelidade.saldo(props.clienteId) : null,
    comPacotes.value ? api.assinaturas.doCliente(props.clienteId) : [],
  ]);
}
watch(() => props.clienteId, carregar, { immediate: true });

const SITUACAO = {
  ativa: (a) =>
    a.vigente
      ? { estado: 'confirmado', texto: `Em vigor até ${formatarData(a.fim)}` }
      : { estado: 'faltou', texto: `Venceu em ${formatarData(a.fim)}` },
  aguardando_pagamento: () => ({
    estado: 'pendente',
    texto: 'Aguardando pagamento',
  }),
};
const situacao = (a) =>
  (SITUACAO[a.estado] ?? SITUACAO.aguardando_pagamento)(a);
const textoDoSaldo = (s) =>
  s.quantidade == null
    ? `${s.servicoNome}: livre (${s.usados} ${s.usados === 1 ? 'uso' : 'usos'})`
    : `${s.servicoNome}: ${s.restantes} de ${s.quantidade}`;

async function vender(dados) {
  const r = await executar(() =>
    api.assinaturas.vender({ clienteId: props.clienteId, ...dados }),
  );
  if (!r) return;
  notificar.sucesso(
    `Comanda #${r.comandaId} aberta no caixa: o pacote vale assim que for pago.`,
  );
  emit('vendido');
  router.push({ path: '/caixa', query: { comanda: r.comandaId } });
}
</script>

<template>
  <section
    v-if="comFidelidade || comPacotes"
    class="fp"
    aria-label="Fidelidade e pacotes"
  >
    <div v-if="comFidelidade && saldo" class="fp__bloco">
      <p class="ds-rotulo">Fidelidade</p>
      <p v-if="saldo.necessarios">
        <strong>{{ saldo.selos }}</strong> selos ·
        {{
          saldo.premiosDisponiveis
            ? `${saldo.premiosDisponiveis} prêmio(s) disponível(is)`
            : `faltam ${saldo.faltamParaPremio} para o prêmio`
        }}
      </p>
      <p>
        Cashback:
        <span class="ds-valor">{{ formatarMoeda(saldo.cashback) }}</span>
      </p>
    </div>

    <div v-if="comPacotes" class="fp__bloco">
      <div class="fp__titulo">
        <p class="ds-rotulo">Pacotes</p>
        <DsBotao
          v-if="pode('pacotes.vender')"
          variante="fantasma"
          tamanho="sm"
          @click="venderAberto = true"
        >
          Vender pacote
        </DsBotao>
      </div>
      <ul v-if="assinaturas.length" class="fp__lista">
        <li v-for="a in assinaturas" :key="a.id">
          <span class="fp__nome">{{ a.pacote.nome }}</span>
          <DsSelo :estado="situacao(a).estado">{{ situacao(a).texto }}</DsSelo>
          <span
            v-for="s in a.saldo"
            :key="s.servicoId"
            class="ds-corpo-sm ds-suave"
          >
            {{ textoDoSaldo(s) }}
          </span>
        </li>
      </ul>
      <p v-else class="ds-corpo-sm ds-suave">Nenhum pacote.</p>
    </div>

    <VenderPacoteDialogo v-model="venderAberto" @vender="vender" />
  </section>
</template>

<style scoped>
.fp {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--esp-4);
  margin-top: var(--esp-4);
  padding-top: var(--esp-4);
  border-top: 1px solid var(--linha);
}
.fp p {
  margin: 0;
}
.fp__bloco {
  display: grid;
  align-content: start;
  gap: var(--esp-1);
}
.fp__titulo {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fp__lista {
  display: grid;
  gap: var(--esp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.fp__lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-1) var(--esp-2);
}
.fp__nome {
  font-weight: 600;
}
</style>
