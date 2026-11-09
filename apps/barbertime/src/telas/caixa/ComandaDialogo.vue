<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsAbas,
  DsAcao,
  DsBotao,
  DsCaixaDeSelecao,
  DsDialogo,
  DsEscolha,
  DsInput,
  DsInputMoeda,
  DsSelect,
  DsSelo,
  DsTabela,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import {
  FORMAS_DE_PAGAMENTO,
  limiteDeCashback,
  motivoParaUsarPremio,
  totalDaComanda,
} from '@barbertime/dominio';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { rotuloDaForma, seloDaComanda } from './rotulos.js';
import BuscaCliente from '../clientes/BuscaCliente.vue';
import { moduloAtivo } from '../../sessao/sessao.js';

// Comanda (planejamentos 0008 e 0010): itens em abas de serviço e produto à
// esquerda; pagamento estilo PDV à direita.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });

const { confirmar, negar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const barbeiros = ref([]);
const catalogo = ref({ servico: [], produto: [] });
const comanda = ref(null);
const aba = ref('servico');
const novoItem = ref({ id: null, quantidade: 1 });
const ocupado = ref(false);
// Pacotes do cliente (planejamento 0015): usar o pacote num serviço da comanda.
const assinaturas = ref([]);
const usarPacote = ref(false);
watch(
  () => comanda.value?.clienteId,
  async (id) => {
    assinaturas.value =
      id && moduloAtivo('pacotes') ? await api.assinaturas.doCliente(id) : [];
  },
);
const pacoteDisponivel = computed(() =>
  aba.value === 'servico' && novoItem.value.id
    ? (assinaturas.value.find(
        (a) =>
          a.vigente &&
          a.pacote.itens.some((i) => i.servicoId === novoItem.value.id),
      ) ?? null)
    : null,
);
watch(pacoteDisponivel, (p) => (usarPacote.value = Boolean(p)));

// Fidelidade na comanda (planejamento 0034): saldo do cliente e resgate do
// prêmio e do cashback. A API confere tudo de novo ao receber.
const fidelidade = ref(null);
watch(
  () => comanda.value?.clienteId,
  async (id, antigo) => {
    // Trocar de cliente desfaz o resgate que era do anterior.
    if (antigo && id !== antigo && comanda.value?.estado === 'aberta') {
      comanda.value.premioFidelidade = false;
      comanda.value.cashbackUsado = 0;
    }
    if (!id || !moduloAtivo('fidelidade')) {
      fidelidade.value = null;
      return;
    }
    const [config, saldo] = await Promise.all([
      api.fidelidade.obterConfig(),
      api.fidelidade.saldo(id),
    ]);
    fidelidade.value = { config, saldo };
  },
);
const podeUsarPremio = computed(
  () =>
    Boolean(fidelidade.value) &&
    (comanda.value.premioFidelidade ||
      !motivoParaUsarPremio({
        ...fidelidade.value,
        clienteId: comanda.value.clienteId,
      })),
);
const nomeDoPremio = computed(
  () =>
    catalogo.value.servico.find(
      (s) => s.id === fidelidade.value?.config.selos.premioServicoId,
    )?.nome ?? 'o prêmio',
);
const limiteCashback = computed(() =>
  fidelidade.value
    ? limiteDeCashback({
        saldo: fidelidade.value.saldo,
        comanda: comanda.value,
      })
    : 0,
);
const saldoDoServico = computed(() => {
  const s = pacoteDisponivel.value?.saldo.find(
    (x) => x.servicoId === novoItem.value.id,
  );
  if (!s) return '';
  return s.quantidade == null
    ? 'Livre'
    : `Restam ${s.restantes} de ${s.quantidade}`;
});

watch(aberto, async (abriu) => {
  if (!abriu) return;
  aba.value = 'servico';
  novoItem.value = { id: null, quantidade: 1 };
  const [b, servicos, produtos] = await Promise.all([
    api.barbeiros.listar(),
    api.servicos.listar(),
    api.produtos.listar(),
  ]);
  barbeiros.value = b;
  // Consumível é de uso interno e não entra na comanda (planejamento 0027).
  catalogo.value = {
    servico: servicos,
    produto: produtos.filter((p) => p.tipo !== 'consumivel'),
  };
  comanda.value = props.id
    ? await api.comandas.obter(props.id)
    : {
        clienteId: null,
        barbeiroId: null,
        itens: [],
        desconto: 0,
        premioFidelidade: false,
        cashbackUsado: 0,
        forma: null,
        estado: 'aberta',
      };
});

// Trocar de aba limpa o item que estava sendo escolhido.
watch(aba, () => (novoItem.value = { id: null, quantidade: 1 }));

const editavel = computed(() => comanda.value?.estado === 'aberta');
const titulo = computed(() =>
  props.id
    ? `Comanda #${props.id}${comanda.value ? ` · ${comanda.value.hora}` : ''}`
    : 'Nova comanda',
);
const totais = computed(() =>
  comanda.value ? totalDaComanda(comanda.value) : null,
);

const TIPOS = {
  servico: {
    singular: 'serviço',
    plural: 'Serviços',
    vazio: 'Nenhum serviço na comanda',
  },
  produto: {
    singular: 'produto',
    plural: 'Produtos',
    vazio: 'Nenhum produto na comanda',
  },
};

const itensDo = (tipo) =>
  (comanda.value?.itens ?? [])
    .map((item, indice) => ({
      ...item,
      id: indice,
      subtotal: item.preco * item.quantidade,
    }))
    .filter(
      (item) => (item.tipo === 'produto' ? 'produto' : 'servico') === tipo,
    );

const abas = computed(() =>
  Object.entries(TIPOS).map(([valor, t]) => ({
    valor,
    rotulo: `${t.plural} (${itensDo(valor).reduce((n, i) => n + i.quantidade, 0)})`,
  })),
);

const opcoesBarbeiros = computed(() =>
  barbeiros.value.map((b) => ({ valor: b.id, rotulo: b.nome })),
);
const opcoesDoCatalogo = (tipo) =>
  catalogo.value[tipo].map((x) => ({
    valor: x.id,
    rotulo: `${x.nome} · ${formatarMoeda(x.preco)}`,
  }));

const colunasItens = [
  { campo: 'nome', titulo: 'Item' },
  { campo: 'quantidade', titulo: 'Qtd.', alinhamento: 'centro' },
  {
    campo: 'preco',
    titulo: 'Preço',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
  {
    campo: 'subtotal',
    titulo: 'Subtotal',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
  { campo: 'acoes', titulo: '' },
];

async function incluir(tipo) {
  const ref = catalogo.value[tipo].find((x) => x.id === novoItem.value.id);
  if (!ref) return;
  if (tipo === 'servico' && usarPacote.value && pacoteDisponivel.value) {
    const assinatura = pacoteDisponivel.value;
    const jaNaComanda = comanda.value.itens
      .filter((i) => i.assinaturaId === assinatura.id)
      .map((i) => i.refId);
    const r = await api.assinaturas.podeUsar({
      assinaturaId: assinatura.id,
      servicoId: ref.id,
      jaNaComanda,
    });
    if (!r.ok) {
      await negar(r.motivo);
      return;
    }
    comanda.value.itens.push({
      tipo: 'servico',
      refId: ref.id,
      nome: `${ref.nome} (pacote)`,
      preco: 0,
      quantidade: 1,
      barbeiroId: comanda.value.barbeiroId,
      assinaturaId: assinatura.id,
    });
    novoItem.value = { id: null, quantidade: 1 };
    return;
  }
  comanda.value.itens.push({
    tipo,
    refId: ref.id,
    nome: ref.nome,
    preco: ref.preco,
    quantidade: Math.max(1, Number(novoItem.value.quantidade) || 1),
    barbeiroId: comanda.value.barbeiroId,
  });
  novoItem.value = { id: null, quantidade: 1 };
}

function remover(indice) {
  const [item] = comanda.value.itens.splice(indice, 1);
  if (item?.premio) comanda.value.premioFidelidade = false;
}

async function salvarRascunho() {
  const salva = await executar(() => api.comandas.salvar(comanda.value));
  if (salva) comanda.value = salva;
  return salva;
}

async function salvar() {
  ocupado.value = true;
  const salva = await salvarRascunho();
  ocupado.value = false;
  if (!salva) return;
  notificar.sucesso('Comanda salva em aberto.');
  aberto.value = false;
}

async function receber() {
  ocupado.value = true;
  const forma = comanda.value.forma;
  const salva = await salvarRascunho();
  const paga =
    salva && (await executar(() => api.comandas.receber(salva.id, { forma })));
  ocupado.value = false;
  if (!paga) return;
  const ganhos = (paga.creditos ?? []).map((c) =>
    c.tipo === 'selo' ? '+1 selo' : `+${formatarMoeda(c.valor)} de cashback`,
  );
  notificar.sucesso(
    `Recebido ${formatarMoeda(paga.total)} em ${rotuloDaForma(paga.forma)}.${
      ganhos.length ? ` Cliente ganhou ${ganhos.join(' e ')}.` : ''
    }`,
  );
  aberto.value = false;
}

async function cancelar() {
  if (!props.id) {
    aberto.value = false;
    return;
  }
  const ok = await confirmar('Cancelar esta comanda? Ela não entra no caixa.', {
    perigo: true,
    textoOk: 'Cancelar comanda',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feita = await executar(() => api.comandas.cancelar(props.id));
  if (!feita) return;
  notificar.sucesso('Comanda cancelada.');
  aberto.value = false;
}
</script>

<template>
  <DsDialogo v-model="aberto" :titulo="titulo" largura="xl" fechavel>
    <div v-if="comanda" class="comanda">
      <!-- Itens -->
      <section class="itens" aria-label="Itens da comanda">
        <div class="dupla">
          <BuscaCliente
            v-if="editavel"
            v-model="comanda.clienteId"
            permitir-avulso
          />
          <div v-else class="cliente-leitura">
            <p class="ds-rotulo">Cliente</p>
            <p>{{ comanda.clienteNome }}</p>
          </div>
          <DsSelect
            v-model="comanda.barbeiroId"
            rotulo="Barbeiro"
            :opcoes="opcoesBarbeiros"
            :desabilitado="!editavel"
          />
        </div>

        <DsAbas v-model="aba" :abas="abas" rotulo="Tipo de item">
          <template v-for="(t, tipo) in TIPOS" :key="tipo" #[tipo]>
            <div class="painel">
              <div v-if="editavel" class="incluir">
                <DsSelect
                  v-model="novoItem.id"
                  :rotulo="`Escolher ${t.singular}`"
                  :opcoes="opcoesDoCatalogo(tipo)"
                />
                <DsInput
                  v-model="novoItem.quantidade"
                  tipo="numero"
                  rotulo="Qtd."
                />
                <DsBotao
                  variante="secundario"
                  :desabilitado="!novoItem.id"
                  @click="incluir(tipo)"
                >
                  Incluir
                </DsBotao>
              </div>
              <DsCaixaDeSelecao
                v-if="editavel && tipo === 'servico' && pacoteDisponivel"
                v-model="usarPacote"
                :rotulo="`Usar o pacote ${pacoteDisponivel.pacote.nome}`"
                :descricao="`${saldoDoServico} · o serviço sai por R$ 0,00`"
              />

              <!-- Rola por dentro só se a lista passar de 40% da tela. -->
              <div class="painel__lista">
                <DsTabela
                  :colunas="colunasItens"
                  :linhas="itensDo(tipo)"
                  :texto-vazio="t.vazio"
                  sem-rodape
                  compacta
                >
                  <template #celula-acoes="{ linha }">
                    <DsBotao
                      v-if="editavel"
                      variante="fantasma"
                      tamanho="sm"
                      :aria-label="`Remover ${linha.nome}`"
                      @click.stop="remover(linha.id)"
                    >
                      Remover
                    </DsBotao>
                  </template>
                </DsTabela>
              </div>

              <p class="painel__total">
                <span class="ds-rotulo"
                  >Total em {{ t.plural.toLowerCase() }}</span
                >
                <span class="ds-valor">
                  {{
                    formatarMoeda(
                      totais[tipo === 'produto' ? 'produtos' : 'servicos'],
                    )
                  }}
                </span>
              </p>
            </div>
          </template>
        </DsAbas>
      </section>

      <!-- Pagamento (estilo PDV) -->
      <section class="pagamento" aria-label="Pagamento">
        <div v-if="!editavel" class="pagamento__situacao">
          <DsSelo :estado="seloDaComanda(comanda.estado).estado">
            {{ seloDaComanda(comanda.estado).texto }}
          </DsSelo>
          <span v-if="comanda.forma" class="ds-suave">{{
            rotuloDaForma(comanda.forma)
          }}</span>
        </div>

        <dl class="resumo">
          <div>
            <dt>Serviços</dt>
            <dd class="ds-valor">{{ formatarMoeda(totais.servicos) }}</dd>
          </div>
          <div>
            <dt>Produtos</dt>
            <dd class="ds-valor">{{ formatarMoeda(totais.produtos) }}</dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd class="ds-valor">{{ formatarMoeda(totais.subtotal) }}</dd>
          </div>
          <div>
            <dt>Desconto</dt>
            <dd class="ds-valor">− {{ formatarMoeda(totais.desconto) }}</dd>
          </div>
          <div v-if="totais.cashback">
            <dt>Cashback</dt>
            <dd class="ds-valor">− {{ formatarMoeda(totais.cashback) }}</dd>
          </div>
          <div class="resumo__total">
            <dt class="ds-rotulo">Total</dt>
            <dd>{{ formatarMoeda(totais.total) }}</dd>
          </div>
        </dl>

        <template v-if="editavel">
          <section
            v-if="fidelidade"
            class="fidelidade"
            aria-label="Fidelidade do cliente"
          >
            <p class="ds-rotulo">Fidelidade</p>
            <p class="ds-corpo-sm">
              <template v-if="fidelidade.config.selos.ativo">
                {{ fidelidade.saldo.selos }} de
                {{ fidelidade.config.selos.necessarios }} selos ·
              </template>
              {{ formatarMoeda(fidelidade.saldo.cashback) }} de cashback
            </p>
            <DsCaixaDeSelecao
              v-if="podeUsarPremio"
              v-model="comanda.premioFidelidade"
              :rotulo="`Usar prêmio: ${nomeDoPremio} grátis`"
              :descricao="`Gasta ${fidelidade.config.selos.necessarios} selos ao receber`"
            />
            <DsInputMoeda
              v-if="fidelidade.saldo.cashback > 0"
              v-model="comanda.cashbackUsado"
              :rotulo="`Usar cashback (até ${formatarMoeda(limiteCashback)})`"
            />
          </section>
          <DsInputMoeda v-model="comanda.desconto" rotulo="Desconto" />
          <DsEscolha
            v-model="comanda.forma"
            :opcoes="FORMAS_DE_PAGAMENTO"
            rotulo="Forma de pagamento"
          />

          <DsAcao
            icone="dinheiro"
            :titulo="`Receber ${formatarMoeda(totais.total)}`"
            :descricao="
              comanda.forma
                ? `Em ${rotuloDaForma(comanda.forma)} · fecha a comanda`
                : 'Escolha a forma de pagamento'
            "
            variante="primario"
            :desabilitado="ocupado"
            @click="receber"
          />
          <div class="acoes-secundarias">
            <DsAcao
              icone="hora"
              titulo="Salvar aberta"
              compacta
              :desabilitado="ocupado"
              @click="salvar"
            />
            <DsAcao
              icone="fechar"
              :titulo="id ? 'Cancelar comanda' : 'Descartar'"
              variante="perigo"
              compacta
              :desabilitado="ocupado"
              @click="cancelar"
            />
          </div>
        </template>
      </section>
    </div>
  </DsDialogo>
</template>

<style scoped>
.comanda {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: var(--esp-6);
}
.comanda p {
  margin: 0;
}
.itens {
  display: grid;
  align-content: start;
  gap: var(--esp-3);
}
.dupla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  align-items: start;
  gap: var(--esp-3);
}
.painel {
  display: grid;
  gap: var(--esp-3);
}
.incluir {
  display: grid;
  grid-template-columns: 1fr 5.5rem auto;
  align-items: center;
  gap: var(--esp-2);
}
.painel__lista {
  max-height: 50vh;
  overflow-y: auto;
}
.painel__total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: var(--esp-3);
}
.pagamento {
  display: grid;
  align-content: start;
  gap: var(--esp-3);
  padding-left: var(--esp-6);
  border-left: 1px solid var(--linha);
}
.pagamento__situacao {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
}
/* Resumo em duas colunas: serviços | produtos, subtotal | desconto, total. */
.resumo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--esp-1) var(--esp-4);
  margin: 0;
  padding: var(--esp-3) var(--esp-4);
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
}
.resumo div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--esp-2);
}
.resumo dt,
.resumo dd {
  margin: 0;
}
.resumo__total {
  grid-column: 1 / -1;
  padding-top: var(--esp-2);
  border-top: 1px solid var(--linha-forte);
}
.resumo__total dd {
  font: var(--tipo-titulo);
  letter-spacing: var(--tipo-titulo-espacamento);
}
.pagamento :deep(.ds-escolha) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.acoes-secundarias {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--esp-2);
}
/* Telas estreitas: pagamento vai para baixo dos itens. */
@media (max-width: 56rem) {
  .comanda {
    grid-template-columns: 1fr;
  }
  .pagamento {
    padding-top: var(--esp-4);
    padding-left: 0;
    border-top: 1px solid var(--linha);
    border-left: 0;
  }
}
.fidelidade {
  display: grid;
  gap: var(--esp-2);
  padding: var(--esp-3);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  background: var(--placa-funda);
}
.fidelidade p {
  margin: 0;
}
</style>
