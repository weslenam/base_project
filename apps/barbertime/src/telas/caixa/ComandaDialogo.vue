<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsAbas,
  DsAcao,
  DsBotao,
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
import { FORMAS_DE_PAGAMENTO, totalDaComanda } from '@barbertime/dominio';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import { rotuloDaForma, seloDaComanda } from './rotulos.js';

// Comanda (planejamentos 0008 e 0010): itens em abas de serviço e produto à
// esquerda; pagamento estilo PDV à direita.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const clientes = ref([]);
const barbeiros = ref([]);
const catalogo = ref({ servico: [], produto: [] });
const comanda = ref(null);
const aba = ref('servico');
const novoItem = ref({ id: null, quantidade: 1 });
const ocupado = ref(false);

watch(aberto, async (abriu) => {
  if (!abriu) return;
  aba.value = 'servico';
  novoItem.value = { id: null, quantidade: 1 };
  const [c, b, servicos, produtos] = await Promise.all([
    api.clientes.listar(),
    api.barbeiros.listar(),
    api.servicos.listar(),
    api.produtos.listar(),
  ]);
  clientes.value = c;
  barbeiros.value = b;
  catalogo.value = { servico: servicos, produto: produtos };
  comanda.value = props.id
    ? await api.comandas.obter(props.id)
    : {
        clienteId: null,
        barbeiroId: null,
        itens: [],
        desconto: 0,
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

const opcoesClientes = computed(() =>
  clientes.value.map((c) => ({ valor: c.id, rotulo: c.nome })),
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

function incluir(tipo) {
  const ref = catalogo.value[tipo].find((x) => x.id === novoItem.value.id);
  if (!ref) return;
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
  comanda.value.itens.splice(indice, 1);
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
  notificar.sucesso(
    `Recebido ${formatarMoeda(paga.total)} em ${rotuloDaForma(paga.forma)}.`,
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
  <DsDialogo v-model="aberto" :titulo="titulo" largura="lg">
    <div v-if="comanda" class="comanda">
      <!-- Itens -->
      <section class="itens" aria-label="Itens da comanda">
        <div class="dupla">
          <DsSelect
            v-model="comanda.clienteId"
            rotulo="Cliente"
            :opcoes="opcoesClientes"
            ajuda="Vazio = cliente avulso"
            limpavel
            :desabilitado="!editavel"
          />
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

              <DsTabela
                :colunas="colunasItens"
                :linhas="itensDo(tipo)"
                :texto-vazio="t.vazio"
                sem-rodape
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

              <p class="painel__total">
                <span class="ds-rotulo"
                  >Total em {{ t.plural.toLowerCase() }}</span
                >
                <span class="ds-valor">{{
                  formatarMoeda(
                    totais[tipo === 'produto' ? 'produtos' : 'servicos'],
                  )
                }}</span>
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
          <div class="resumo__subtotal">
            <dt>Subtotal</dt>
            <dd class="ds-valor">{{ formatarMoeda(totais.subtotal) }}</dd>
          </div>
          <div>
            <dt>Desconto</dt>
            <dd class="ds-valor">− {{ formatarMoeda(totais.desconto) }}</dd>
          </div>
          <div class="resumo__total">
            <dt class="ds-rotulo">Total</dt>
            <dd>{{ formatarMoeda(totais.total) }}</dd>
          </div>
        </dl>

        <template v-if="editavel">
          <DsInputMoeda v-model="comanda.desconto" rotulo="Desconto" />
          <p class="ds-rotulo">Forma de pagamento</p>
          <DsEscolha
            v-model="comanda.forma"
            :opcoes="FORMAS_DE_PAGAMENTO"
            rotulo="Forma de pagamento"
          />

          <div class="acoes">
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
            <DsAcao
              icone="hora"
              titulo="Salvar aberta"
              descricao="Continua depois"
              :desabilitado="ocupado"
              @click="salvar"
            />
            <DsAcao
              icone="fechar"
              :titulo="id ? 'Cancelar comanda' : 'Descartar'"
              :descricao="id ? 'Não entra no caixa' : 'Sai sem salvar'"
              variante="perigo"
              :desabilitado="ocupado"
              @click="cancelar"
            />
          </div>
        </template>
      </section>
    </div>

    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Fechar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.comanda {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
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
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--esp-3);
}
.painel {
  display: grid;
  gap: var(--esp-3);
}
.incluir {
  display: grid;
  grid-template-columns: 1fr 5.5rem auto;
  align-items: start;
  gap: var(--esp-2);
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
.resumo {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
  padding: var(--esp-3) var(--esp-4);
  border-radius: var(--raio-sm);
  background: var(--placa-funda);
}
.resumo div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.resumo dt,
.resumo dd {
  margin: 0;
}
.resumo__subtotal {
  padding-top: var(--esp-1);
  border-top: 1px solid var(--linha);
}
.resumo__total {
  padding-top: var(--esp-2);
  border-top: 1px solid var(--linha-forte);
}
.resumo__total dd {
  font: var(--tipo-titulo);
  letter-spacing: var(--tipo-titulo-espacamento);
}
.acoes {
  display: grid;
  gap: var(--esp-2);
  margin-top: var(--esp-2);
}
/* Celular e telas estreitas: pagamento vai para baixo dos itens. */
@media (max-width: 48rem) {
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
</style>
