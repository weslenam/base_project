<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  DsBlocoAgenda,
  DsBotao,
  DsIcone,
  DsInput,
  DsPagina,
} from '@barbertime/ui';
import type { EstadoVisual } from '@barbertime/ui';
import { formatarDiaCurto } from '@barbertime/ui-utils';
import { hojeIso, podeMarcarNaAgenda, somarDias } from '@barbertime/dominio';
import { api } from '../../dados/api.ts';
import type { Barbeiro, ItemAgenda } from '../../dados/modelos.ts';
import { useSessao } from '../../sessao/sessao.ts';
import NovoAgendamento from './NovoAgendamento.vue';
import DetalheAgendamento from './DetalheAgendamento.vue';
import BloquearHorario from './BloquearHorario.vue';
import ComandaDialogo from '../caixa/ComandaDialogo.vue';

const data = ref(hojeIso());
const barbeiros = ref<Barbeiro[]>([]);
const agendamentos = ref<ItemAgenda[]>([]);

// Recepção e Barbeiro (agenda.ajudar) marcam e bloqueiam (planejamento 0035).
const { sessao } = useSessao();
const podeMarcar = computed(() =>
  podeMarcarNaAgenda(sessao.value?.permissoes ?? []),
);

const novoAberto = ref(false);
const bloqueioAberto = ref(false);
// Atalhos da coluna já abrem o diálogo com o barbeiro dela; os botões do topo, sem.
const barbeiroDoAtalho = ref<number | null>(null);
function novoAgendamento(barbeiroId: number | null = null) {
  barbeiroDoAtalho.value = barbeiroId;
  novoAberto.value = true;
}
function bloquearHorario(barbeiroId: number | null = null) {
  barbeiroDoAtalho.value = barbeiroId;
  bloqueioAberto.value = true;
}
const detalheAberto = ref(false);
const comandaId = ref<number | null>(null);
const comandaAberta = ref(false);
function abrirComanda(id: number) {
  comandaId.value = id;
  comandaAberta.value = true;
}
const selecionadoId = ref<number | null>(null);

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

function abrir(id: number) {
  selecionadoId.value = id;
  detalheAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Agenda" :sobretitulo="sobretitulo">
    <template v-if="podeMarcar" #acoes>
      <DsBotao variante="secundario" @click="bloquearHorario()">
        <DsIcone nome="bloqueio" />
        Bloquear horário
      </DsBotao>
      <DsBotao @click="novoAgendamento()">
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
          <div v-if="podeMarcar" class="coluna__atalhos">
            <DsBotao
              variante="fantasma"
              tamanho="sm"
              denso
              @click="bloquearHorario(coluna.id)"
            >
              <DsIcone
                nome="bloqueio"
                :rotulo="`Bloquear horário de ${coluna.nome}`"
              />
            </DsBotao>
            <DsBotao
              variante="fantasma"
              tamanho="sm"
              denso
              @click="novoAgendamento(coluna.id)"
            >
              <DsIcone
                nome="adicionar"
                :rotulo="`Novo agendamento com ${coluna.nome}`"
              />
            </DsBotao>
          </div>
        </header>
        <div class="coluna__itens">
          <DsBlocoAgenda
            v-for="a in coluna.itens"
            :key="a.id"
            :cliente="a.clienteNome"
            :servico="a.servicoNome"
            :inicio="a.inicio ?? undefined"
            :fim="a.fim ?? undefined"
            :estado="a.estado as EstadoVisual"
            clicavel
            @selecionar="abrir(a.id)"
          />
          <p v-if="!coluna.itens.length" class="coluna__vazio">
            Sem agendamentos
          </p>
        </div>
      </section>
    </div>

    <NovoAgendamento
      v-model="novoAberto"
      :data="data"
      :barbeiro-id="barbeiroDoAtalho"
      @criado="carregar"
    />
    <BloquearHorario
      v-model="bloqueioAberto"
      :data="data"
      :barbeiro-id="barbeiroDoAtalho"
      @criado="carregar"
    />
    <DetalheAgendamento
      :id="selecionadoId"
      v-model="detalheAberto"
      @alterado="carregar"
      @comanda="abrirComanda"
    />
    <ComandaDialogo :id="comandaId" v-model="comandaAberta" />
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
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--esp-2);
  padding: var(--esp-3);
  background: var(--placa-funda);
  border-bottom: 1px solid var(--linha);
}
.coluna__nome {
  /* Ocupa a sobra sem encolher: em coluna estreita, hora e atalhos descem. */
  flex: 1 0 auto;
  margin: 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
/* Atalhos: bloquear e agendar já com o barbeiro da coluna. */
.coluna__atalhos {
  display: flex;
  gap: var(--esp-1);
  align-self: center;
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
