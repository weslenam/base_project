<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
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

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ id: { type: Number, default: null } });

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const clientes = ref([]);
const barbeiros = ref([]);
const servicos = ref([]);
const produtos = ref([]);
const comanda = ref(null);
const novoItem = ref({ chave: null, quantidade: 1 });
const ocupado = ref(false);

watch(aberto, async (abriu) => {
  if (!abriu) return;
  novoItem.value = { chave: null, quantidade: 1 };
  [clientes.value, barbeiros.value, servicos.value, produtos.value] =
    await Promise.all([
      api.clientes.listar(),
      api.barbeiros.listar(),
      api.servicos.listar(),
      api.produtos.listar(),
    ]);
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

const editavel = computed(() => comanda.value?.estado === 'aberta');
const titulo = computed(() =>
  props.id
    ? `Comanda #${props.id}${comanda.value ? ` · ${comanda.value.hora}` : ''}`
    : 'Nova comanda',
);
const totais = computed(() =>
  comanda.value ? totalDaComanda(comanda.value) : null,
);

const opcoesClientes = computed(() =>
  clientes.value.map((c) => ({ valor: c.id, rotulo: c.nome })),
);
const opcoesBarbeiros = computed(() =>
  barbeiros.value.map((b) => ({ valor: b.id, rotulo: b.nome })),
);
const opcoesItens = computed(() => [
  ...servicos.value.map((s) => ({
    valor: `servico:${s.id}`,
    rotulo: `Serviço · ${s.nome} · ${formatarMoeda(s.preco)}`,
  })),
  ...produtos.value.map((p) => ({
    valor: `produto:${p.id}`,
    rotulo: `Produto · ${p.nome} · ${formatarMoeda(p.preco)}`,
  })),
]);
const formas = FORMAS_DE_PAGAMENTO;

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
const linhasItens = computed(() =>
  (comanda.value?.itens ?? []).map((i, indice) => ({
    ...i,
    id: indice,
    subtotal: i.preco * i.quantidade,
  })),
);

function incluir() {
  const [tipo, id] = String(novoItem.value.chave ?? '').split(':');
  const ref = (tipo === 'produto' ? produtos : servicos).value.find(
    (x) => x.id === Number(id),
  );
  if (!ref) return;
  comanda.value.itens.push({
    tipo,
    refId: ref.id,
    nome: ref.nome,
    preco: ref.preco,
    quantidade: Math.max(1, Number(novoItem.value.quantidade) || 1),
    barbeiroId: comanda.value.barbeiroId,
  });
  novoItem.value = { chave: null, quantidade: 1 };
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
  const salva = await salvarRascunho();
  const paga =
    salva &&
    (await executar(() =>
      api.comandas.receber(salva.id, { forma: comanda.value.forma }),
    ));
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
      <div v-if="!editavel" class="comanda__situacao">
        <DsSelo :estado="seloDaComanda(comanda.estado).estado">
          {{ seloDaComanda(comanda.estado).texto }}
        </DsSelo>
        <span v-if="comanda.forma" class="ds-suave">{{
          rotuloDaForma(comanda.forma)
        }}</span>
      </div>

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

      <div v-if="editavel" class="incluir">
        <DsSelect
          v-model="novoItem.chave"
          rotulo="Serviço ou produto"
          :opcoes="opcoesItens"
        />
        <DsInput v-model="novoItem.quantidade" tipo="numero" rotulo="Qtd." />
        <DsBotao
          variante="secundario"
          :desabilitado="!novoItem.chave"
          @click="incluir"
        >
          Incluir
        </DsBotao>
      </div>

      <DsTabela
        :colunas="colunasItens"
        :linhas="linhasItens"
        :itens-por-pagina="-1"
        texto-vazio="Nenhum item na comanda"
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

      <div class="fechamento">
        <div class="fechamento__campos">
          <DsInputMoeda
            v-model="comanda.desconto"
            rotulo="Desconto"
            :desabilitado="!editavel"
          />
          <DsSelect
            v-model="comanda.forma"
            rotulo="Forma de pagamento"
            :opcoes="formas"
            :desabilitado="!editavel"
          />
        </div>
        <dl class="totais">
          <div>
            <dt class="ds-rotulo">Subtotal</dt>
            <dd class="ds-valor">{{ formatarMoeda(totais.subtotal) }}</dd>
          </div>
          <div>
            <dt class="ds-rotulo">Desconto</dt>
            <dd class="ds-valor">− {{ formatarMoeda(totais.desconto) }}</dd>
          </div>
          <div class="totais__total">
            <dt class="ds-rotulo">Total</dt>
            <dd class="ds-subtitulo">{{ formatarMoeda(totais.total) }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <template #acoes>
      <template v-if="editavel">
        <DsBotao variante="fantasma" class="acao-cancelar" @click="cancelar">
          {{ id ? 'Cancelar comanda' : 'Descartar' }}
        </DsBotao>
        <DsBotao variante="secundario" :carregando="ocupado" @click="salvar"
          >Salvar aberta</DsBotao
        >
        <DsBotao :carregando="ocupado" @click="receber">
          Receber {{ totais ? formatarMoeda(totais.total) : '' }}
        </DsBotao>
      </template>
      <DsBotao v-else variante="secundario" @click="aberto = false"
        >Fechar</DsBotao
      >
    </template>
  </DsDialogo>
</template>

<style scoped>
.comanda {
  display: grid;
  gap: var(--esp-3);
}
.comanda__situacao {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
}
.dupla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--esp-3);
}
.incluir {
  display: grid;
  grid-template-columns: 1fr 6rem auto;
  align-items: start;
  gap: var(--esp-2);
}
.fechamento {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--esp-4);
  align-items: start;
}
.totais {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
}
.totais div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.totais dt,
.totais dd {
  margin: 0;
}
.totais__total {
  padding-top: var(--esp-2);
  border-top: 1px solid var(--linha);
}
.acao-cancelar {
  margin-inline-end: auto;
}
</style>
