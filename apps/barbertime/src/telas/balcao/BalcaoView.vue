<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  DsBotao,
  DsCartao,
  DsIcone,
  DsInputMoeda,
  DsPagina,
  DsSelo,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { podeAgirNoBalcao } from '@barbertime/dominio';
import { balcao } from '../../dados/balcao.js';
import { useAcao } from '../../dados/useAcao.js';
import { useSessao } from '../../sessao/sessao.js';
import ComandaDialogo from '../caixa/ComandaDialogo.vue';
import AvulsoDialogo from './AvulsoDialogo.vue';

// Balcão (planejamento 0020, fase 1; especificação docs/atendimento/balcao.md):
// Agora · Fila e chegadas · Próximos, com "+ Avulso" sempre à mão.
// Atualiza sozinho a cada 15 s (tempo real de verdade na fase 2).
const ATUALIZAR_MS = 15_000;

const router = useRouter();
const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const painel = ref(null);
const avulsoAberto = ref(false);
const comandaId = ref(null);
const comandaAberta = ref(false);
const trocoInicial = ref(0);
const ocupado = ref(null); // id do item com ação em andamento

async function carregar() {
  const p = await executar(() => balcao.painel());
  if (p) painel.value = p;
}
let timer;
onMounted(() => {
  carregar();
  timer = setInterval(carregar, ATUALIZAR_MS);
});
onUnmounted(() => clearInterval(timer));
watch(comandaAberta, (aberta) => {
  if (!aberta) carregar();
});

/** Executa uma ação do balcão e recarrega; devolve o resultado. */
async function agir(id, chamada, mensagem) {
  ocupado.value = id;
  const r = await executar(chamada);
  ocupado.value = null;
  if (r && mensagem) notificar.sucesso(mensagem(r));
  await carregar();
  return r;
}

// Só aparece o que a API vai aceitar (planejamento 0036): o Barbeiro inicia
// consigo, finaliza e pausa os próprios, e marca desistência e falta na
// própria coluna ou no que lançou.
const { sessao } = useSessao();
const pode = (acao, alvo = {}) =>
  podeAgirNoBalcao(
    {
      usuarioId: sessao.value?.usuario?.id,
      permissoes: sessao.value?.permissoes,
    },
    acao,
    alvo,
  );
const podeAbrirCaixa = computed(() =>
  Boolean(sessao.value?.permissoes?.includes('caixa.abrir')),
);
const contaDoBarbeiro = (id) =>
  painel.value?.barbeiros.find((b) => b.id === id)?.usuarioId ?? null;
const podeIniciar = (f) =>
  pode('iniciar', {
    destinoUsuarioId: contaDoBarbeiro(f.barbeiroSugeridoId ?? f.barbeiroId),
  });

const nomeDoBarbeiro = (id) =>
  painel.value?.barbeiros.find((b) => b.id === id)?.nome ?? 'Primeiro livre';

const SELO_BARBEIRO = {
  livre: { estado: 'confirmado', texto: 'Livre' },
  ocupado: { estado: 'fila', texto: 'Ocupado' },
  pausa: { estado: 'neutro', texto: 'Pausa' },
};

const iniciar = (item) =>
  agir(
    item.id,
    () => balcao.iniciar(item.id, item.barbeiroSugeridoId ?? item.barbeiroId),
    (a) => `${a.clienteNome} começou com ${a.barbeiroNome}.`,
  );

async function desistir(item) {
  const ok = await confirmar(
    `${item.clienteNome} desistiu de esperar? A comanda aberta é cancelada.`,
    { textoOk: 'Desistiu', textoCancelar: 'Continua na fila' },
  );
  if (ok) await agir(item.id, () => balcao.desistir(item.id));
}

async function marcarFalta(item) {
  const ok = await confirmar(
    `${item.clienteNome} não veio ao horário das ${item.inicio}? Isso registra a falta.`,
    { textoOk: 'Marcar falta', textoCancelar: 'Aguardar' },
  );
  if (ok) await agir(item.id, () => balcao.noShow(item.id));
}

const checkin = (item) =>
  agir(
    item.id,
    () => balcao.checkin(item.id),
    (a) => `${a.clienteNome} chegou.`,
  );

const finalizar = (b) =>
  agir(
    b.atual.id,
    () => balcao.finalizar(b.atual.id),
    (a) => {
      // Finalizou: já abre a comanda para cobrar.
      if (a.comandaId) cobrar(a.comandaId);
      return `${a.clienteNome} finalizado. Hora de cobrar.`;
    },
  );

const pausar = (b) =>
  agir(
    `p${b.id}`,
    () => balcao.pausa(b.id, b.estado !== 'pausa'),
    (r) => (r.emPausa ? `${b.nome} em pausa.` : `${b.nome} voltou.`),
  );

function cobrar(id) {
  comandaId.value = id;
  comandaAberta.value = true;
}

async function abrirCaixa() {
  const r = await agir('caixa', () => balcao.abrirCaixa(trocoInicial.value));
  if (r) notificar.sucesso('Caixa aberto. Bom trabalho!');
}

const espera = (min) =>
  min == null ? '—' : min === 0 ? 'agora' : `~${min} min`;
const servicos = computed(() => painel.value?.servicos ?? []);
</script>

<template>
  <DsPagina
    titulo="Balcão"
    :sobretitulo="painel ? `Hoje · ${painel.agora}` : 'Hoje'"
  >
    <template #acoes>
      <DsBotao variante="fantasma" @click="router.push('/agenda')">
        Agenda
      </DsBotao>
      <DsBotao
        :desabilitado="!painel?.caixaAberto"
        @click="avulsoAberto = true"
      >
        <DsIcone nome="adicionar" />
        Avulso
      </DsBotao>
    </template>

    <DsCartao v-if="painel && !painel.caixaAberto" titulo="Caixa fechado">
      <!-- Abrir o caixa tem permissão própria; o Barbeiro só pede
           (planejamento 0039). -->
      <p v-if="!podeAbrirCaixa" class="ds-corpo-sm">
        O caixa de hoje ainda não foi aberto. Peça à recepção ou ao gerente
        para abrir; depois dá para registrar avulsos e fazer check-in.
      </p>
      <p v-else class="ds-corpo-sm">
        Para registrar avulsos e fazer check-in, abra o caixa de hoje.
      </p>
      <div v-if="podeAbrirCaixa" class="abrir">
        <DsInputMoeda v-model="trocoInicial" rotulo="Troco inicial" />
        <DsBotao :carregando="ocupado === 'caixa'" @click="abrirCaixa">
          Abrir caixa
        </DsBotao>
      </div>
    </DsCartao>

    <div v-if="painel" class="balcao">
      <!-- Agora -->
      <section class="coluna" aria-label="Agora">
        <h2 class="coluna__titulo">Agora</h2>
        <article
          v-for="b in painel.barbeiros"
          :key="b.id"
          :class="['barbeiro', `barbeiro--${b.estado}`]"
          :aria-label="b.nome"
        >
          <header class="barbeiro__topo">
            <strong>{{ b.nome }}</strong>
            <DsSelo :estado="SELO_BARBEIRO[b.estado].estado">
              {{ SELO_BARBEIRO[b.estado].texto
              }}{{ b.estado === 'ocupado' ? ` · ${b.restanteMin} min` : '' }}
            </DsSelo>
          </header>
          <p v-if="b.atual" class="ds-corpo-sm">
            {{ b.atual.clienteNome }} · {{ b.atual.servicoNome }}
          </p>
          <p v-if="b.proximo" class="ds-corpo-sm ds-suave">
            Próximo: <span class="ds-hora">{{ b.proximo.inicio }}</span>
            {{ b.proximo.clienteNome }}
          </p>
          <div class="barbeiro__acoes">
            <DsBotao
              v-if="b.atual && pode('finalizar', { barbeiroUsuarioId: b.usuarioId })"
              tamanho="sm"
              :carregando="ocupado === b.atual.id"
              @click="finalizar(b)"
            >
              Finalizar
            </DsBotao>
            <DsBotao
              v-if="pode('pausa', { barbeiroUsuarioId: b.usuarioId })"
              variante="fantasma"
              tamanho="sm"
              :carregando="ocupado === `p${b.id}`"
              @click="pausar(b)"
            >
              {{ b.estado === 'pausa' ? 'Voltar' : 'Pausa' }}
            </DsBotao>
          </div>
        </article>
      </section>

      <!-- Fila e chegadas -->
      <section class="coluna" aria-label="Fila e chegadas">
        <h2 class="coluna__titulo">
          Fila e chegadas
          <span class="ds-suave">({{ painel.fila.length }})</span>
        </h2>
        <ul v-if="painel.aCobrar.length" class="lista" aria-label="A cobrar">
          <li v-for="a in painel.aCobrar" :key="a.id" class="item item--cobrar">
            <span>
              <strong>{{ a.clienteNome }}</strong>
              <span class="ds-corpo-sm ds-suave">
                · {{ a.servicoNome }} · {{ a.barbeiroNome }}</span
              >
            </span>
            <DsBotao tamanho="sm" @click="cobrar(a.comandaId)">Cobrar</DsBotao>
          </li>
        </ul>
        <ol v-if="painel.fila.length" class="lista" aria-label="Fila">
          <li v-for="(f, i) in painel.fila" :key="f.id" class="item">
            <span class="item__posicao ds-valor">{{ i + 1 }}</span>
            <span class="item__info">
              <strong>{{ f.clienteNome }}</strong>
              <span class="ds-corpo-sm ds-suave">
                {{ f.servicoNome }} ·
                {{ f.barbeiroId ? f.barbeiroNome : 'Primeiro livre' }} · chegou
                {{ f.chegouAs }}
              </span>
              <span class="ds-corpo-sm">
                <DsSelo v-if="f.estado === 'chegou'" estado="confirmado">
                  Agendado {{ f.inicio }}
                </DsSelo>
                <DsSelo v-else estado="fila">Avulso</DsSelo>
                <template v-if="f.podeAgora">
                  Pode começar agora com
                  {{ nomeDoBarbeiro(f.barbeiroSugeridoId) }}
                </template>
                <template v-else> Espera {{ espera(f.esperaMin) }}</template>
              </span>
            </span>
            <span class="item__acoes">
              <DsBotao
                v-if="podeIniciar(f)"
                tamanho="sm"
                :desabilitado="!f.podeAgora"
                :carregando="ocupado === f.id"
                @click="iniciar(f)"
              >
                Iniciar
              </DsBotao>
              <DsBotao
                v-if="pode('desistir', f)"
                variante="fantasma"
                tamanho="sm"
                @click="desistir(f)"
              >
                Desistiu
              </DsBotao>
            </span>
          </li>
        </ol>
        <p v-else class="ds-corpo-sm ds-suave vazio">Ninguém esperando.</p>
      </section>

      <!-- Próximos -->
      <section class="coluna" aria-label="Próximos">
        <h2 class="coluna__titulo">Próximos</h2>
        <ul v-if="painel.proximos.length" class="lista">
          <li v-for="p in painel.proximos" :key="p.id" class="item">
            <span class="ds-hora item__hora">{{ p.inicio }}</span>
            <span class="item__info">
              <strong>{{ p.clienteNome }}</strong>
              <span class="ds-corpo-sm ds-suave"
                >{{ p.servicoNome }} · {{ p.barbeiroNome }}</span
              >
            </span>
            <DsBotao
              tamanho="sm"
              :desabilitado="!painel.caixaAberto"
              :carregando="ocupado === p.id"
              @click="checkin(p)"
            >
              Check-in
            </DsBotao>
          </li>
        </ul>
        <p v-else class="ds-corpo-sm ds-suave vazio">
          Nenhum agendamento nas próximas horas.
        </p>
        <template v-if="painel.atrasados.length">
          <h3 class="ds-rotulo">Não chegaram</h3>
          <ul class="lista" aria-label="Atrasados">
            <li v-for="p in painel.atrasados" :key="p.id" class="item">
              <span class="ds-hora item__hora">{{ p.inicio }}</span>
              <span class="item__info">
                <strong>{{ p.clienteNome }}</strong>
                <span class="ds-corpo-sm ds-suave">{{ p.barbeiroNome }}</span>
              </span>
              <span class="item__acoes">
                <DsBotao
                  variante="secundario"
                  tamanho="sm"
                  :desabilitado="!painel.caixaAberto"
                  @click="checkin(p)"
                >
                  Chegou
                </DsBotao>
                <DsBotao
                  v-if="pode('no_show', p)"
                  variante="fantasma"
                  tamanho="sm"
                  @click="marcarFalta(p)"
                >
                  Falta
                </DsBotao>
              </span>
            </li>
          </ul>
        </template>
      </section>
    </div>

    <AvulsoDialogo
      v-model="avulsoAberto"
      :servicos="servicos"
      :exigir-telefone="painel?.config.exigirTelefone"
      @registrado="carregar"
    />
    <ComandaDialogo :id="comandaId" v-model="comandaAberta" />
  </DsPagina>
</template>

<style scoped>
.balcao {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr);
  gap: var(--esp-4);
  align-items: start;
}
.coluna {
  display: grid;
  gap: var(--esp-2);
  padding: var(--esp-3);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  background: var(--placa);
}
.coluna__titulo {
  margin: 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.coluna h3 {
  margin: var(--esp-2) 0 0;
}
.barbeiro {
  display: grid;
  gap: var(--esp-1);
  padding: var(--esp-3);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--confirmado, var(--cobre));
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
}
.barbeiro--ocupado {
  border-left-color: var(--fila, var(--cobre));
}
.barbeiro--pausa {
  border-left-color: var(--linha-forte);
  opacity: 0.75;
}
.barbeiro p {
  margin: 0;
}
.barbeiro__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esp-2);
}
.barbeiro__acoes,
.item__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--esp-1);
}
.lista {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--esp-2);
  padding: var(--esp-2);
  border: 1px solid var(--linha);
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
}
.item--cobrar {
  grid-template-columns: minmax(0, 1fr) auto;
  border-color: var(--cobre);
  background: var(--cobre-suave);
}
.item__info {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.item__posicao {
  width: 2rem;
  text-align: center;
}
.item__hora {
  min-width: 3.2rem;
}
.vazio {
  margin: 0;
  padding: var(--esp-3) 0;
}
.abrir {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--esp-3);
}
/* Tablet em pé e celular: colunas empilhadas, fila primeiro. */
@media (max-width: 64rem) {
  .balcao {
    grid-template-columns: 1fr 1fr;
  }
  .balcao > :nth-child(2) {
    grid-column: 1 / -1;
    order: -1;
  }
}
@media (max-width: 40rem) {
  .balcao {
    grid-template-columns: 1fr;
  }
}
</style>
