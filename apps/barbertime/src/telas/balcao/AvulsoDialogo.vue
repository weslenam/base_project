<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsEscolha,
  DsInput,
  DsInputTelefone,
  useNotificacao,
} from '@barbertime/ui';
import { formatarMoeda, validarTelefone } from '@barbertime/ui-utils';
import { balcao } from '../../dados/balcao.ts';
import { useAcao } from '../../dados/useAcao.ts';

// Avulso em até 3 toques (especificação docs/atendimento/balcao.md):
// 1. serviço · 2. barbeiro ("Primeiro livre" é o padrão) · 3. WhatsApp ou pular.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({
  /** Serviços, os mais vendidos primeiro. */
  servicos: { type: Array, default: () => [] },
  exigirTelefone: Boolean,
});
const emit = defineEmits(['registrado']);

const notificar = useNotificacao();
const executar = useAcao();

const servicoId = ref(null);
const servico = computed(() =>
  props.servicos.find((s) => s.id === servicoId.value),
);
const encaixe = ref(null);
const barbeiroId = ref(null); // null = primeiro livre
const telefone = ref(null);
const nome = ref('');
const enviando = ref(false);

watch(aberto, (abriu) => {
  if (!abriu) return;
  servicoId.value = null;
  encaixe.value = null;
  barbeiroId.value = null;
  telefone.value = null;
  nome.value = '';
});

const opcoesServico = computed(() =>
  props.servicos.map((s) => ({
    valor: s.id,
    rotulo: s.nome,
    detalhe: `${s.duracao} min · ${formatarMoeda(s.preco)}`,
  })),
);

// Escolher o serviço já calcula a espera com cada barbeiro.
watch(servicoId, async (id) => {
  encaixe.value = null;
  barbeiroId.value = null;
  if (id) encaixe.value = await executar(() => balcao.encaixe(id));
});

const espera = (p) =>
  p.estado === 'pausa'
    ? 'Em pausa'
    : p.inicioPrevisto === null
      ? 'Não cabe hoje'
      : p.podeAgora
        ? 'Agora'
        : `~${p.esperaMin} min`;

const opcoesBarbeiro = computed(() => {
  if (!encaixe.value) return [];
  const pl = encaixe.value.primeiroLivre;
  return [
    {
      valor: null,
      rotulo: 'Primeiro livre',
      detalhe: pl
        ? `${pl.barbeiroNome} · ${pl.esperaMin ? `~${pl.esperaMin} min` : 'agora'}`
        : 'Ninguém consegue hoje',
      desabilitado: !pl,
    },
    ...encaixe.value.porBarbeiro.map((p) => ({
      valor: p.barbeiroId,
      rotulo: p.barbeiroNome,
      detalhe: espera(p),
      desabilitado: p.estado === 'pausa' || p.inicioPrevisto === null,
    })),
  ];
});

const telefoneOk = computed(() => validarTelefone(telefone.value));

async function registrar({ semTelefone = false } = {}) {
  if (!semTelefone && telefone.value && !telefoneOk.value) {
    notificar.aviso('Confira o WhatsApp (DDD + número) ou pule.');
    return;
  }
  enviando.value = true;
  const a = await executar(() =>
    balcao.avulso({
      servicoId: servicoId.value,
      barbeiroId: barbeiroId.value,
      telefone: semTelefone ? null : telefone.value,
      nome: semTelefone ? null : nome.value.trim() || null,
    }),
  );
  enviando.value = false;
  if (!a) return;
  notificar.sucesso(`${a.clienteNome} entrou na fila (${a.servicoNome}).`);
  aberto.value = false;
  emit('registrado', a);
}
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Avulso" largura="lg" fechavel>
    <div class="avulso">
      <section aria-label="1. Serviço" class="etapa">
        <p class="ds-rotulo">1 · Serviço</p>
        <DsEscolha
          v-model="servicoId"
          :opcoes="opcoesServico"
          rotulo="Serviço do avulso"
          grande
        />
      </section>

      <section v-if="servico" aria-label="2. Barbeiro" class="etapa">
        <p class="ds-rotulo">2 · Barbeiro</p>
        <p v-if="!encaixe" class="ds-corpo-sm ds-suave">Calculando a espera…</p>
        <DsEscolha
          v-else
          v-model="barbeiroId"
          :opcoes="opcoesBarbeiro"
          rotulo="Barbeiro do avulso"
          grande
        />
      </section>

      <section v-if="servico && encaixe" aria-label="3. Cliente" class="etapa">
        <p class="ds-rotulo">
          3 · Cliente {{ exigirTelefone ? '' : '(opcional)' }}
        </p>
        <div class="cliente">
          <DsInputTelefone
            v-model="telefone"
            rotulo="WhatsApp do cliente"
            ajuda="Para selos, cashback e lembretes. Quem já é cliente é achado pelo número."
            :obrigatorio="exigirTelefone"
          />
          <DsInput
            v-model="nome"
            rotulo="Nome (se for novo)"
            dica="Dá para completar depois"
          />
        </div>
      </section>
    </div>

    <template #acoes>
      <DsBotao
        v-if="servico && encaixe && !exigirTelefone"
        variante="secundario"
        :carregando="enviando"
        @click="registrar({ semTelefone: true })"
      >
        Pular · Cliente balcão
      </DsBotao>
      <DsBotao
        :desabilitado="!servico || !encaixe || (exigirTelefone && !telefoneOk)"
        :carregando="enviando"
        @click="registrar()"
      >
        Colocar na fila
      </DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.avulso {
  display: grid;
  gap: var(--esp-5, 20px);
}
.etapa {
  display: grid;
  gap: var(--esp-2);
}
.etapa p {
  margin: 0;
}
.cliente {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--esp-3);
}
</style>
