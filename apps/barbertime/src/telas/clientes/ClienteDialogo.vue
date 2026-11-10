<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsAbas,
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputCpf,
  DsInputTelefone,
  DsSelo,
  DsTextarea,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarDiaCurto, formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { seloDoEstado } from '../estados.ts';
import { rotuloDaForma, seloDaComanda } from '../caixa/rotulos.ts';
import FidelidadeEPacotesCliente from './FidelidadeEPacotesCliente.vue';

// Cadastro do cliente (planejamentos 0006 e 0016): ao editar, cadastro à esquerda e,
// à direita, abas Resumo · Comandas ("Ver mais") · Agendamentos, sem rolar o diálogo.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const POR_PAGINA = 5;
const form = ref({});
const salvando = ref(false);
const editando = computed(() => Boolean(props.id));

const aba = ref('resumo');
const resumo = ref(null);
const comandas = ref({ itens: [], total: 0 });
const agendamentos = ref([]);
const carregandoMais = ref(false);

watch(aberto, async (abriu) => {
  if (!abriu) return;
  aba.value = 'resumo';
  resumo.value = null;
  comandas.value = { itens: [], total: 0 };
  agendamentos.value = [];
  if (!props.id) {
    form.value = { nome: '', telefone: null, cpf: null, observacoes: '' };
    return;
  }
  const [cliente, r, primeiras, passados] = await Promise.all([
    api.clientes.obter(props.id),
    api.clientes.resumo(props.id),
    api.clientes.comandas(props.id, { limite: POR_PAGINA }),
    api.clientes.historico(props.id),
  ]);
  form.value = cliente;
  resumo.value = r;
  comandas.value = primeiras;
  agendamentos.value = passados;
});

const abas = computed(() => [
  { valor: 'resumo', rotulo: 'Resumo' },
  { valor: 'comandas', rotulo: `Comandas (${comandas.value.total})` },
  {
    valor: 'agendamentos',
    rotulo: `Agendamentos (${agendamentos.value.length})`,
  },
]);
const temMais = computed(
  () => comandas.value.itens.length < comandas.value.total,
);

async function verMais() {
  carregandoMais.value = true;
  const pagina = await api.clientes.comandas(props.id, {
    limite: POR_PAGINA,
    deslocamento: comandas.value.itens.length,
  });
  comandas.value = {
    total: pagina.total,
    itens: [...comandas.value.itens, ...pagina.itens],
  };
  carregandoMais.value = false;
}

const descreverItens = (c) =>
  c.itens
    .map((i) => (i.quantidade > 1 ? `${i.quantidade}× ${i.nome}` : i.nome))
    .join(', ');

async function salvar() {
  salvando.value = true;
  const salvo = await executar(() => api.clientes.salvar(form.value));
  salvando.value = false;
  if (!salvo) return;
  notificar.sucesso(
    editando.value ? 'Cadastro atualizado.' : `${salvo.nome} cadastrado.`,
  );
  aberto.value = false;
  emit('salvo', salvo);
}

async function excluir() {
  const ok = await confirmar(
    `Excluir ${form.value.nome}? O histórico de atendimentos também sai do cadastro.`,
    {
      titulo: 'Excluir cliente',
      perigo: true,
      textoOk: 'Excluir',
      textoCancelar: 'Manter',
    },
  );
  if (!ok) return;
  const feito = await executar(
    async () => (await api.clientes.excluir(props.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Cliente excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? form.nome || 'Cliente' : 'Novo cliente'"
    :largura="editando ? 'xl' : 'md'"
    fechavel
  >
    <div :class="['cliente', { 'cliente--editando': editando }]">
      <!-- Cadastro -->
      <DsFormulario id="form-cliente" class="cadastro" @enviar="salvar">
        <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
        <div class="dupla">
          <DsInputTelefone v-model="form.telefone" obrigatorio />
          <DsInputCpf v-model="form.cpf" ajuda="Opcional, para nota fiscal" />
        </div>
        <DsTextarea
          v-model="form.observacoes"
          rotulo="Observações"
          dica="Preferências, alergias, como gosta do corte..."
          :max-caracteres="500"
        />
      </DsFormulario>

      <!-- Histórico em abas -->
      <section v-if="editando" class="painel" aria-label="Histórico do cliente">
        <DsAbas v-model="aba" :abas="abas" rotulo="Histórico do cliente">
          <template #resumo>
            <div v-if="resumo" class="resumo">
              <dl class="numeros">
                <div>
                  <dt class="ds-rotulo">Em serviços</dt>
                  <dd class="ds-valor">
                    {{ formatarMoeda(resumo.totalServicos) }}
                  </dd>
                </div>
                <div>
                  <dt class="ds-rotulo">Em produtos</dt>
                  <dd class="ds-valor">
                    {{ formatarMoeda(resumo.totalProdutos) }}
                  </dd>
                </div>
                <div class="numeros__destaque">
                  <dt class="ds-rotulo">Total gasto</dt>
                  <dd class="ds-valor">
                    {{ formatarMoeda(resumo.totalGasto) }}
                  </dd>
                </div>
                <div>
                  <dt class="ds-rotulo">Comandas</dt>
                  <dd class="ds-valor">{{ resumo.comandas }}</dd>
                </div>
                <div>
                  <dt class="ds-rotulo">Ticket médio</dt>
                  <dd class="ds-valor">
                    {{ formatarMoeda(resumo.ticketMedio) }}
                  </dd>
                </div>
                <div>
                  <dt class="ds-rotulo">Faltas</dt>
                  <dd class="ds-valor">{{ resumo.faltas }}</dd>
                </div>
              </dl>
              <p v-if="resumo.ultimoServico" class="ultimo">
                <span class="ds-rotulo">Último serviço</span>
                <span>
                  <strong>{{ resumo.ultimoServico.nome }}</strong> ·
                  {{ formatarDiaCurto(resumo.ultimoServico.data) }} ·
                  {{ resumo.ultimoServico.barbeiroNome }}
                </span>
              </p>
              <p v-else class="ds-corpo-sm ds-suave">
                Nenhuma comanda paga ainda.
              </p>
              <FidelidadeEPacotesCliente
                v-if="form.id"
                class="fp-no-painel"
                :cliente-id="form.id"
                @vendido="aberto = false"
              />
            </div>
          </template>

          <template #comandas>
            <div class="rolavel">
              <ul
                v-if="comandas.itens.length"
                class="lista"
                aria-label="Comandas do cliente"
              >
                <li v-for="c in comandas.itens" :key="c.id" class="comanda">
                  <span class="ds-hora comanda__quando">
                    {{ formatarDiaCurto(c.data) }} {{ c.hora }}
                  </span>
                  <span class="comanda__itens">{{ descreverItens(c) }}</span>
                  <span class="comanda__total">
                    <span class="ds-valor">{{ formatarMoeda(c.total) }}</span>
                    <span
                      v-if="c.estado === 'paga'"
                      class="ds-corpo-sm ds-suave"
                    >
                      {{ rotuloDaForma(c.forma) }}
                    </span>
                    <DsSelo v-else :estado="seloDaComanda(c.estado).estado">
                      {{ seloDaComanda(c.estado).texto }}
                    </DsSelo>
                  </span>
                </li>
              </ul>
              <p v-else class="ds-corpo-sm ds-suave">Nenhuma comanda ainda.</p>
              <DsBotao
                v-if="temMais"
                variante="secundario"
                tamanho="sm"
                :carregando="carregandoMais"
                @click="verMais"
              >
                Ver mais ({{ comandas.total - comandas.itens.length }})
              </DsBotao>
            </div>
          </template>

          <template #agendamentos>
            <div class="rolavel">
              <ul
                v-if="agendamentos.length"
                class="lista"
                aria-label="Agendamentos do cliente"
              >
                <li v-for="a in agendamentos" :key="a.id" class="agendamento">
                  <span class="ds-hora"
                    >{{ formatarDiaCurto(a.data) }} {{ a.inicio }}</span
                  >
                  <span>{{ a.servicoNome }} · {{ a.barbeiroNome }}</span>
                  <DsSelo :estado="seloDoEstado(a.estado).estado">
                    {{ seloDoEstado(a.estado).texto }}
                  </DsSelo>
                </li>
              </ul>
              <p v-else class="ds-corpo-sm ds-suave">
                Nenhum agendamento ainda.
              </p>
            </div>
          </template>
        </DsAbas>
      </section>
    </div>

    <template #acoes>
      <DsBotao
        v-if="editando"
        variante="perigo"
        class="acao-excluir"
        @click="excluir"
      >
        Excluir
      </DsBotao>
      <DsBotao formulario="form-cliente" :carregando="salvando">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.cliente--editando {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: var(--esp-6);
  align-items: start;
}
.cliente p {
  margin: 0;
}
.dupla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: var(--esp-3);
}
.painel {
  padding-left: var(--esp-6);
  border-left: 1px solid var(--linha);
}
.resumo {
  display: grid;
  gap: var(--esp-3);
}
.numeros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--esp-2);
  margin: 0;
}
.numeros div {
  display: grid;
  gap: 2px;
  padding: var(--esp-2) var(--esp-3);
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
}
.numeros dt,
.numeros dd {
  margin: 0;
}
.numeros__destaque {
  background: var(--cobre-suave) !important;
}
.ultimo {
  display: grid;
  gap: 2px;
}
/* O painel de fidelidade vem com divisória própria; aqui ele já está numa aba. */
.fp-no-painel {
  margin-top: 0;
}
/* Só a lista rola, e só se passar da altura do painel: o diálogo não rola. */
.rolavel {
  display: grid;
  gap: var(--esp-2);
  max-height: 55vh;
  overflow-y: auto;
  padding-right: var(--esp-1);
}
.lista {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.comanda {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--esp-3);
  padding: var(--esp-2) var(--esp-3);
  border: 1px solid var(--linha);
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.comanda__itens {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.comanda__total {
  display: grid;
  justify-items: end;
}
.agendamento {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-2) var(--esp-3);
  padding: var(--esp-2) 0;
  border-bottom: 1px solid var(--linha);
}
.acao-excluir {
  margin-inline-end: auto;
}
/* Telas estreitas: o histórico vai para baixo do cadastro. */
@media (max-width: 56rem) {
  .cliente--editando {
    grid-template-columns: 1fr;
  }
  .painel {
    padding-top: var(--esp-4);
    padding-left: 0;
    border-top: 1px solid var(--linha);
    border-left: 0;
  }
}
</style>
