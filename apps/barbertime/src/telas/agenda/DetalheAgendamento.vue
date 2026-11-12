<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PropType } from 'vue';
import { useRouter } from 'vue-router';
import {
  DsAcao,
  DsBotao,
  DsDialogo,
  DsSelo,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarDiaCurto, formatarTelefone } from '@barbertime/ui-utils';
import { podeAgirNaAgenda } from '@barbertime/dominio';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { semMenu, useSessao } from '../../sessao/sessao.ts';
import { seloDoEstado } from '../estados.ts';
import type { Atendimento, Detalhe } from '../../dados/modelos.ts';

const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  id: { type: Number as PropType<number | null>, default: null },
});
const emit = defineEmits<{
  alterado: [agendamento: Atendimento];
  comanda: [comandaId: number];
}>();

const { confirmar, advertir } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const router = useRouter();
const agendamento = ref<Detalhe | null>(null);

watch(aberto, async (abriu) => {
  agendamento.value = null;
  if (abriu && props.id)
    agendamento.value = await api.agendamentos.obter(props.id);
});

const selo = computed(() => seloDoEstado(agendamento.value?.estado ?? ''));
const bloqueio = computed(() => agendamento.value?.estado === 'bloqueado');
const titulo = computed(() =>
  bloqueio.value ? 'Horário bloqueado' : 'Agendamento',
);

// Só aparece o que a API vai aceitar (planejamento 0035): quem só ajuda na
// agenda mexe no que marcou e nos próprios atendimentos.
const { sessao, pode } = useSessao();
const permite = (estado: string) =>
  podeAgirNaAgenda(
    {
      usuarioId: sessao.value?.usuario?.id,
      permissoes: sessao.value?.permissoes,
    },
    { ...agendamento.value, bloqueio: bloqueio.value },
    estado,
  );
const podeComanda = computed(() => pode('caixa.operar'));
const eHojeOuPassado = computed(() => {
  const data = agendamento.value?.data;
  if (!data) return false;
  const hoje = new Intl.DateTimeFormat('sv', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return data <= hoje;
});
const temAcao = computed(() => {
  const a = agendamento.value;
  if (!a) return false;
  if (bloqueio.value) return permite('cancelado');
  if (a.estado === 'pendente')
    return permite('confirmado') || permite('cancelado');
  if (a.estado === 'confirmado')
    return (
      (a.status !== 'agendado' && permite('atendido')) ||
      (podeComanda.value && !a.comandaId) ||
      permite('faltou') ||
      permite('cancelado')
    );
  if (a.estado === 'atendido') return podeComanda.value && !a.comandaId;
  return false;
});

async function mudar(estado: string, mensagemDeSucesso: string) {
  const id = props.id;
  if (id === null) return;
  const salvo = await executar(() =>
    api.agendamentos.alterarEstado(id, estado),
  );
  if (!salvo) return;
  notificar.sucesso(mensagemDeSucesso);
  aberto.value = false;
  emit('alterado', salvo);
}

const nome = () => agendamento.value?.clienteNome;

async function cancelar() {
  const ok =
    agendamento.value?.estado === 'confirmado'
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
  const id = props.id;
  if (id === null) return;
  const comanda = await executar(() => api.comandas.abrirDoAgendamento(id));
  if (!comanda) return;
  aberto.value = false;
  // Sem a tela Caixa (Barbeiro), a comanda abre na própria Agenda
  // (planejamento 0037).
  if (semMenu()) emit('comanda', comanda.id);
  else router.push({ path: '/caixa', query: { comanda: comanda.id } });
}

async function removerBloqueio() {
  const ok = await confirmar('Remover este bloqueio e liberar o horário?', {
    textoOk: 'Remover bloqueio',
  });
  if (ok) await mudar('cancelado', 'Bloqueio removido.');
}
</script>

<template>
  <DsDialogo v-model="aberto" :titulo="titulo" largura="lg" fechavel>
    <div v-if="agendamento" class="detalhe">
      <!-- Informações -->
      <section class="info" aria-label="Informações do agendamento">
        <div class="info__principal">
          <p class="ds-rotulo">{{ bloqueio ? 'Motivo' : 'Cliente' }}</p>
          <p class="info__cliente">{{ agendamento.clienteNome }}</p>
          <DsSelo v-if="!bloqueio" :estado="selo.estado">{{
            selo.texto
          }}</DsSelo>
        </div>

        <div class="info__horario">
          <p class="ds-rotulo">{{ formatarDiaCurto(agendamento.data) }}</p>
          <p class="info__hora">
            {{ agendamento.inicio }}–{{ agendamento.fim }}
          </p>
        </div>

        <dl class="info__dados">
          <div v-if="agendamento.servicoNome">
            <dt class="ds-rotulo">Serviço</dt>
            <dd>{{ agendamento.servicoNome }}</dd>
          </div>
          <div>
            <dt class="ds-rotulo">Barbeiro</dt>
            <dd>{{ agendamento.barbeiroNome }}</dd>
          </div>
          <div v-if="agendamento.clienteTelefone">
            <dt class="ds-rotulo">Telefone</dt>
            <dd class="ds-valor">
              {{ formatarTelefone(agendamento.clienteTelefone) }}
            </dd>
          </div>
        </dl>

        <div v-if="agendamento.clienteObservacoes" class="info__observacoes">
          <p class="ds-rotulo">Observações do cliente</p>
          <p>{{ agendamento.clienteObservacoes }}</p>
        </div>
      </section>

      <!-- Ações (estilo PDV) -->
      <section class="acoes" aria-label="Ações">
        <p class="ds-rotulo">O que fazer</p>
        <p v-if="!temAcao" class="acoes__vazio">
          {{
            agendamento.estado === 'atendido'
              ? 'Cliente já atendido, nenhuma ação disponível.'
              : 'Nenhuma ação disponível para este agendamento.'
          }}
        </p>
        <template v-else-if="agendamento.estado === 'pendente'">
          <DsAcao
            v-if="permite('confirmado') && eHojeOuPassado"
            icone="check"
            titulo="Confirmar presença"
            descricao="O cliente confirmou que vem"
            variante="primario"
            @click="mudar('confirmado', 'Presença confirmada.')"
          />
          <DsAcao
            v-if="permite('cancelado')"
            icone="fechar"
            titulo="Cancelar agendamento"
            descricao="Libera o horário na agenda"
            variante="perigo"
            @click="cancelar"
          />
        </template>
        <template v-else-if="agendamento.estado === 'confirmado'">
          <!-- Sem check-in no balcão não há comanda: atendido só depois de chegar. -->
          <DsAcao
            v-if="agendamento.status !== 'agendado' && permite('atendido')"
            icone="check"
            titulo="Marcar atendido"
            descricao="Conclui o atendimento"
            variante="primario"
            @click="mudar('atendido', 'Atendimento concluído.')"
          />
          <DsAcao
            v-if="podeComanda && !agendamento.comandaId"
            icone="caixa"
            titulo="Abrir comanda"
            descricao="Lança serviço e produtos no caixa"
            @click="abrirComanda"
          />
          <DsAcao
            v-if="permite('faltou')"
            icone="alerta"
            titulo="Marcar falta"
            descricao="Fica no histórico do cliente"
            variante="perigo"
            @click="marcarFalta"
          />
          <DsAcao
            v-if="permite('cancelado')"
            icone="fechar"
            titulo="Cancelar agendamento"
            descricao="Libera o horário na agenda"
            variante="perigo"
            @click="cancelar"
          />
        </template>
        <DsAcao
          v-else-if="agendamento.estado === 'atendido' && !agendamento.comandaId"
          icone="caixa"
          titulo="Abrir comanda"
          descricao="Lança serviço e produtos no caixa"
          variante="primario"
          @click="abrirComanda"
        />
        <DsAcao
          v-else-if="bloqueio"
          icone="bloqueio"
          titulo="Remover bloqueio"
          descricao="Libera o horário na agenda"
          variante="perigo"
          @click="removerBloqueio"
        />
      </section>
    </div>
  </DsDialogo>
</template>

<style scoped>
.detalhe {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: var(--esp-6);
}
.detalhe p {
  margin: 0;
}
.info {
  display: grid;
  align-content: start;
  gap: var(--esp-4);
}
.info__principal {
  display: grid;
  justify-items: start;
  gap: var(--esp-1);
}
.info__cliente {
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.info__horario {
  padding: var(--esp-3) var(--esp-4);
  background: var(--placa-funda);
  border-radius: var(--raio-sm);
}
.info__hora {
  font: 500 28px/36px var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.info__dados {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--esp-3);
  margin: 0;
}
.info__dados dt,
.info__dados dd {
  margin: 0;
}
.info__observacoes {
  display: grid;
  gap: var(--esp-1);
  padding: var(--esp-3);
  border-left: 4px solid var(--aco);
  border-radius: var(--raio-sm);
  background: var(--aco-suave);
}
.acoes {
  display: grid;
  align-content: start;
  gap: var(--esp-2);
  padding-left: var(--esp-6);
  border-left: 1px solid var(--linha);
}
.acoes__vazio {
  color: var(--grafite-suave);
}
/* Celular: as colunas empilham e as ações vão para baixo. */
@media (max-width: 40rem) {
  .detalhe {
    grid-template-columns: 1fr;
  }
  .acoes {
    padding-top: var(--esp-4);
    padding-left: 0;
    border-top: 1px solid var(--linha);
    border-left: 0;
  }
}
</style>
