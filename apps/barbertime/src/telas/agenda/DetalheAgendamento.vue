<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  DsBotao,
  DsDialogo,
  DsSelo,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarDiaCurto, formatarTelefone } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { seloDoEstado } from '../estados.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });
const emit = defineEmits(['alterado']);

const { confirmar, advertir } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const router = useRouter();
const agendamento = ref(null);

watch(aberto, async (abriu) => {
  agendamento.value = null;
  if (abriu && props.id)
    agendamento.value = await api.agendamentos.obter(props.id);
});

const selo = computed(() => seloDoEstado(agendamento.value?.estado));
const bloqueio = computed(() => agendamento.value?.estado === 'bloqueado');
const titulo = computed(() =>
  bloqueio.value ? 'Horário bloqueado' : 'Agendamento',
);

async function mudar(estado, mensagemDeSucesso) {
  const salvo = await executar(() =>
    api.agendamentos.alterarEstado(props.id, estado),
  );
  if (!salvo) return;
  notificar.sucesso(mensagemDeSucesso);
  aberto.value = false;
  emit('alterado', salvo);
}

const nome = () => agendamento.value.clienteNome;

async function cancelar() {
  const ok =
    agendamento.value.estado === 'confirmado'
      ? await advertir(
          `${nome()} já confirmou presença. Cancelar mesmo assim? Avise o cliente pelo telefone.`,
          { textoOk: 'Cancelar agendamento', textoCancelar: 'Manter' },
        )
      : await confirmar(`Cancelar o agendamento de ${nome()}?`, {
          perigo: true,
          textoOk: 'Cancelar agendamento',
          textoCancelar: 'Manter',
        });
  if (ok)
    await mudar('cancelado', 'Agendamento cancelado. O horário ficou livre.');
}

async function marcarFalta() {
  const ok = await confirmar(
    `Marcar falta para ${nome()}? A falta fica no histórico do cliente.`,
    {
      perigo: true,
      textoOk: 'Marcar falta',
      textoCancelar: 'Voltar',
    },
  );
  if (ok) await mudar('faltou', 'Falta registrada.');
}

async function abrirComanda() {
  const comanda = await executar(() =>
    api.comandas.abrirDoAgendamento(props.id),
  );
  if (!comanda) return;
  aberto.value = false;
  router.push({ path: '/caixa', query: { comanda: comanda.id } });
}

async function removerBloqueio() {
  const ok = await confirmar('Remover este bloqueio e liberar o horário?', {
    textoOk: 'Remover bloqueio',
  });
  if (ok) await mudar('cancelado', 'Bloqueio removido.');
}
</script>

<template>
  <DsDialogo v-model="aberto" :titulo="titulo" largura="sm">
    <dl v-if="agendamento" class="detalhes">
      <div>
        <dt class="ds-rotulo">{{ bloqueio ? 'Motivo' : 'Cliente' }}</dt>
        <dd>{{ agendamento.clienteNome }}</dd>
      </div>
      <div v-if="agendamento.clienteTelefone">
        <dt class="ds-rotulo">Telefone</dt>
        <dd class="ds-valor">
          {{ formatarTelefone(agendamento.clienteTelefone) }}
        </dd>
      </div>
      <div v-if="agendamento.servicoNome">
        <dt class="ds-rotulo">Serviço</dt>
        <dd>{{ agendamento.servicoNome }}</dd>
      </div>
      <div>
        <dt class="ds-rotulo">Barbeiro</dt>
        <dd>{{ agendamento.barbeiroNome }}</dd>
      </div>
      <div>
        <dt class="ds-rotulo">Quando</dt>
        <dd>
          {{ formatarDiaCurto(agendamento.data) }} ·
          <span class="ds-hora"
            >{{ agendamento.inicio }}–{{ agendamento.fim }}</span
          >
        </dd>
      </div>
      <div v-if="!bloqueio">
        <dt class="ds-rotulo">Situação</dt>
        <dd>
          <DsSelo :estado="selo.estado">{{ selo.texto }}</DsSelo>
        </dd>
      </div>
    </dl>

    <template #acoes>
      <template v-if="agendamento?.estado === 'pendente'">
        <DsBotao variante="perigo" @click="cancelar"
          >Cancelar agendamento</DsBotao
        >
        <DsBotao @click="mudar('confirmado', 'Presença confirmada.')"
          >Confirmar presença</DsBotao
        >
      </template>
      <template v-else-if="agendamento?.estado === 'confirmado'">
        <DsBotao variante="fantasma" @click="cancelar">Cancelar</DsBotao>
        <DsBotao variante="perigo" @click="marcarFalta">Marcar falta</DsBotao>
        <DsBotao variante="secundario" @click="abrirComanda"
          >Abrir comanda</DsBotao
        >
        <DsBotao @click="mudar('atendido', 'Atendimento concluído.')"
          >Marcar atendido</DsBotao
        >
      </template>
      <template v-else-if="agendamento?.estado === 'atendido'">
        <DsBotao variante="secundario" @click="aberto = false">Fechar</DsBotao>
        <DsBotao @click="abrirComanda">Abrir comanda</DsBotao>
      </template>
      <template v-else-if="bloqueio">
        <DsBotao variante="secundario" @click="aberto = false">Fechar</DsBotao>
        <DsBotao variante="perigo" @click="removerBloqueio"
          >Remover bloqueio</DsBotao
        >
      </template>
      <DsBotao v-else variante="secundario" @click="aberto = false"
        >Fechar</DsBotao
      >
    </template>
  </DsDialogo>
</template>

<style scoped>
.detalhes {
  display: grid;
  gap: var(--esp-3);
  margin: 0;
}
.detalhes dt {
  margin: 0;
}
.detalhes dd {
  margin: 0;
}
</style>
