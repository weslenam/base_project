<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsCaixaDeSelecao,
  DsDialogo,
  DsEscolha,
  DsInput,
  DsInputMoeda,
  DsSelect,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { TIPOS_DE_PACOTE } from '@barbertime/dominio';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ pacote: { type: Object, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const servicos = ref([]);
const form = ref(null);
const novo = computed(() => !props.pacote);
const MODOS = [
  { valor: 'quantidade', rotulo: 'Quantidade' },
  { valor: 'livre', rotulo: 'Livre' },
];

watch(aberto, async (abriu) => {
  if (!abriu) return;
  servicos.value = await api.servicos.listar();
  const p = props.pacote;
  form.value = {
    nome: p?.nome ?? '',
    preco: p?.preco ?? null,
    tipo: p?.tipo ?? 'recorrente',
    validadeDias: p?.validadeDias ?? 60,
    itens: (p?.itens ?? [{ servicoId: null, quantidade: 4 }]).map((i) => ({
      servicoId: i.servicoId,
      modo: i.quantidade == null ? 'livre' : 'quantidade',
      quantidade: i.quantidade ?? 1,
    })),
    comIntervalo: Boolean(p?.limites?.intervaloMinimoDias),
    intervaloMinimoDias: p?.limites?.intervaloMinimoDias ?? 7,
    comSemanal: Boolean(p?.limites?.maximoPorSemana),
    maximoPorSemana: p?.limites?.maximoPorSemana ?? 1,
  };
});

const opcoesServicos = computed(() =>
  servicos.value.map((s) => ({ valor: s.id, rotulo: s.nome })),
);

function adicionarItem() {
  form.value.itens.push({ servicoId: null, modo: 'quantidade', quantidade: 1 });
}

async function salvar() {
  const f = form.value;
  const dados = {
    id: props.pacote?.id,
    nome: f.nome,
    preco: f.preco,
    tipo: f.tipo,
    validadeDias: f.validadeDias,
    itens: f.itens.map((i) => ({
      servicoId: i.servicoId,
      quantidade: i.modo === 'livre' ? null : Number(i.quantidade),
    })),
    limites: {
      intervaloMinimoDias: f.comIntervalo
        ? Number(f.intervaloMinimoDias)
        : null,
      maximoPorSemana: f.comSemanal ? Number(f.maximoPorSemana) : null,
    },
  };
  const salvo = await executar(() => api.pacotes.salvar(dados));
  if (!salvo) return;
  notificar.sucesso(
    novo.value ? `Pacote ${salvo.nome} criado.` : 'Pacote atualizado.',
  );
  aberto.value = false;
  emit('salvo');
}

async function excluir() {
  const ok = await confirmar(`Excluir o pacote ${props.pacote.nome}?`, {
    perigo: true,
    textoOk: 'Excluir',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await api.pacotes.excluir(props.pacote.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Pacote excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="novo ? 'Novo pacote' : `Pacote ${pacote.nome}`"
    largura="lg"
    fechavel
  >
    <div v-if="form" class="pacote">
      <section class="coluna" aria-label="Dados do pacote">
        <DsInput v-model="form.nome" rotulo="Nome do pacote" />
        <DsInputMoeda
          v-model="form.preco"
          :rotulo="form.tipo === 'recorrente' ? 'Preço por mês' : 'Preço'"
        />
        <p class="ds-rotulo">Vigência</p>
        <DsEscolha
          v-model="form.tipo"
          :opcoes="TIPOS_DE_PACOTE"
          rotulo="Vigência"
        />
        <DsInput
          v-if="form.tipo === 'unico'"
          v-model="form.validadeDias"
          tipo="numero"
          rotulo="Validade (dias a partir da compra)"
        />
        <p v-else class="ds-corpo-sm ds-suave">
          Renova a cada mês; o saldo do mês não acumula.
        </p>

        <p class="ds-rotulo">Limite de uso</p>
        <DsCaixaDeSelecao
          v-model="form.comIntervalo"
          rotulo="Intervalo mínimo entre usos do mesmo serviço"
        />
        <DsInput
          v-if="form.comIntervalo"
          v-model="form.intervaloMinimoDias"
          tipo="numero"
          rotulo="Dias entre usos"
        />
        <DsCaixaDeSelecao
          v-model="form.comSemanal"
          rotulo="Máximo de usos por semana"
        />
        <DsInput
          v-if="form.comSemanal"
          v-model="form.maximoPorSemana"
          tipo="numero"
          rotulo="Usos por semana"
        />
        <p
          v-if="!form.comIntervalo && !form.comSemanal"
          class="ds-corpo-sm ds-suave"
        >
          Sem limite: o cliente usa quando quiser, dentro do saldo e da
          vigência.
        </p>
      </section>

      <section class="coluna" aria-label="Serviços do pacote">
        <p class="ds-rotulo">Serviços incluídos</p>
        <div v-for="(item, i) in form.itens" :key="i" class="item">
          <DsSelect
            v-model="item.servicoId"
            rotulo="Serviço"
            :opcoes="opcoesServicos"
          />
          <DsEscolha
            v-model="item.modo"
            :opcoes="MODOS"
            :rotulo="`Quantidade do item ${i + 1}`"
          />
          <DsInput
            v-if="item.modo === 'quantidade'"
            v-model="item.quantidade"
            tipo="numero"
            rotulo="Quantidade"
          />
          <DsBotao
            v-if="form.itens.length > 1"
            variante="fantasma"
            tamanho="sm"
            @click="form.itens.splice(i, 1)"
          >
            Remover serviço
          </DsBotao>
        </div>
        <DsBotao variante="secundario" tamanho="sm" @click="adicionarItem">
          Incluir outro serviço
        </DsBotao>
      </section>
    </div>
    <template #acoes>
      <DsBotao
        v-if="!novo"
        variante="perigo"
        class="acao-excluir"
        @click="excluir"
        >Excluir</DsBotao
      >
      <DsBotao @click="salvar">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.pacote {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--esp-6);
}
.coluna {
  display: grid;
  align-content: start;
  gap: var(--esp-3);
}
.coluna p {
  margin: 0;
}
.item {
  display: grid;
  gap: var(--esp-2);
  padding: var(--esp-3);
  border: 1px solid var(--linha);
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.acao-excluir {
  margin-inline-end: auto;
}
</style>
