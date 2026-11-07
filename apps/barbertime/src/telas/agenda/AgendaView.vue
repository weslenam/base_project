<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  DsBlocoAgenda,
  DsBotao,
  DsIcone,
  DsInput,
  DsPagina,
} from '@barbertime/ui';
import { formatarDiaCurto } from '@barbertime/ui-utils';
import { hojeIso, somarDias } from '@barbertime/dominio';
import { api } from '../../dados/api.js';
import NovoAgendamento from './NovoAgendamento.vue';
import DetalheAgendamento from './DetalheAgendamento.vue';
import BloquearHorario from './BloquearHorario.vue';

const data = ref(hojeIso());
const barbeiros = ref([]);
const agendamentos = ref([]);

const novoAberto = ref(false);
const bloqueioAberto = ref(false);
const detalheAberto = ref(false);
const selecionadoId = ref(null);

async function carregar() {
  [barbeiros.value, agendamentos.value] = await Promise.all([
    api.barbeiros.listar(),
    api.agendamentos.listarDoDia(data.value),
  ]);
}
onMounted(carregar);
watch(data, carregar);

const ehHoje = computed(() => data.value === hojeIso());
const sobretitulo = computed(
  () => `${ehHoje.value ? 'Hoje · ' : ''}${formatarDiaCurto(data.value)}`,
);
const colunas = computed(() =>
  barbeiros.value.map((b) => ({
    ...b,
    itens: agendamentos.value.filter((a) => a.barbeiroId === b.id),
  })),
);

function abrir(id) {
  selecionadoId.value = id;
  detalheAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Agenda" :sobretitulo="sobretitulo">
    <template #acoes>
      <DsBotao variante="secundario" @click="bloqueioAberto = true">
        <DsIcone nome="bloqueio" />
        Bloquear horário
      </DsBotao>
      <DsBotao @click="novoAberto = true">
        <DsIcone nome="adicionar" />
        Novo agendamento
      </DsBotao>
    </template>

    <nav class="navegacao" aria-label="Escolher dia">
      <DsBotao
        variante="secundario"
        tamanho="sm"
        @click="data = somarDias(data, -1)"
      >
        <DsIcone nome="anterior" rotulo="Dia anterior" />
      </DsBotao>
      <DsBotao
        variante="secundario"
        tamanho="sm"
        :desabilitado="ehHoje"
        @click="data = hojeIso()"
      >
        Hoje
      </DsBotao>
      <DsBotao
        variante="secundario"
        tamanho="sm"
        @click="data = somarDias(data, 1)"
      >
        <DsIcone nome="proximo" rotulo="Próximo dia" />
      </DsBotao>
      <div class="navegacao__data">
        <DsInput v-model="data" tipo="data" rotulo="Dia" />
      </div>
    </nav>

    <div class="quadro">
      <section
        v-for="coluna in colunas"
        :key="coluna.id"
        class="coluna"
        :aria-label="`Agenda de ${coluna.nome}`"
      >
        <header class="coluna__cabecalho">
          <h2 class="coluna__nome">{{ coluna.nome }}</h2>
          <span class="ds-hora ds-suave"
            >{{ coluna.inicio }}–{{ coluna.fim }}</span
          >
        </header>
        <div class="coluna__itens">
          <DsBlocoAgenda
            v-for="a in coluna.itens"
            :key="a.id"
            :cliente="a.clienteNome"
            :servico="a.servicoNome"
            :inicio="a.inicio"
            :fim="a.fim"
            :estado="a.estado"
            clicavel
            @selecionar="abrir(a.id)"
          />
          <p v-if="!coluna.itens.length" class="coluna__vazio">
            Sem agendamentos
          </p>
        </div>
      </section>
    </div>

    <NovoAgendamento v-model="novoAberto" :data="data" @criado="carregar" />
    <BloquearHorario v-model="bloqueioAberto" :data="data" @criado="carregar" />
    <DetalheAgendamento
      :id="selecionadoId"
      v-model="detalheAberto"
      @alterado="carregar"
    />
  </DsPagina>
</template>

<style scoped>
.navegacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-2);
}
.navegacao__data {
  width: 12rem;
  margin-inline-start: auto;
}
.quadro {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(15rem, 1fr);
  gap: var(--esp-3);
  overflow-x: auto;
  padding-bottom: var(--esp-2);
}
.coluna {
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--placa);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
}
.coluna__cabecalho {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--esp-2);
  padding: var(--esp-3);
  background: var(--placa-funda);
  border-bottom: 1px solid var(--linha);
}
.coluna__nome {
  margin: 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.coluna__itens {
  display: grid;
  align-content: start;
  gap: var(--esp-2);
  padding: var(--esp-3);
}
.coluna__vazio {
  margin: 0;
  color: var(--grafite-suave);
}
</style>
