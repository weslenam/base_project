<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PropType } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsInputMoeda,
  DsSelect,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { moduloAtivo, pode } from '../../sessao/sessao.ts';
import type { ItemFicha, Produto, Servico } from '../../dados/modelos.ts';

const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  id: { type: Number as PropType<number | null>, default: null },
});
const emit = defineEmits(['salvo']);

const { confirmar, advertir, negar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const form = ref<{
  id?: number;
  nome: string;
  duracao: number;
  preco: number | null;
}>({ nome: '', duracao: 30, preco: null });
const original = ref<Servico | null>(null);
const editando = computed(() => Boolean(props.id));
// Ficha técnica (planejamento 0027): consumíveis gastos por serviço.
const comFicha = computed(() => moduloAtivo('estoque') && pode('estoque.ver'));
const editaFicha = computed(() => comFicha.value && pode('estoque.gerenciar'));
const ficha = ref<
  (Partial<Omit<ItemFicha, 'produtoId' | 'quantidade'>> & {
    produtoId: number | null;
    quantidade: number | string;
  })[]
>([]);
let fichaOriginal = '[]';
const resumoDaFicha = () =>
  JSON.stringify(
    ficha.value.map((l) => ({
      produtoId: l.produtoId,
      quantidade: Number(l.quantidade),
    })),
  );
const consumiveis = ref<Produto[]>([]);
const opcoesConsumiveis = computed(() =>
  consumiveis.value.map((p) => ({
    valor: p.id,
    rotulo: `${p.nome} (${p.unidade})`,
  })),
);
const duracoes = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120].map((m) => ({
  valor: m,
  rotulo: `${m} min`,
}));

watch(aberto, async (abriu) => {
  if (!abriu) return;
  const servicos = await api.servicos.listar();
  original.value = servicos.find((s) => s.id === props.id) ?? null;
  form.value = original.value
    ? { ...original.value }
    : { nome: '', duracao: 30, preco: null };
  ficha.value = [];
  fichaOriginal = '[]';
  if (!comFicha.value) return;
  const [linhas, produtos] = await Promise.all([
    props.id ? api.fichas.obter(props.id) : [],
    api.produtos.listar(),
  ]);
  consumiveis.value = produtos.filter((p) => p.tipo === 'consumivel');
  ficha.value = linhas.map((l) => ({ ...l }));
  fichaOriginal = resumoDaFicha();
});

const fichaMudou = () => editaFicha.value && resumoDaFicha() !== fichaOriginal;

async function salvar() {
  const atual = original.value;
  if (
    editando.value &&
    props.id !== null &&
    atual &&
    form.value.duracao !== atual.duracao
  ) {
    const futuros = await api.servicos.contarFuturos(props.id);
    if (futuros) {
      const seguir = await advertir(
        `Há ${futuros} agendamento${futuros > 1 ? 's' : ''} futuro${futuros > 1 ? 's' : ''} de "${atual.nome}". A nova duração vale só para os próximos; os já marcados continuam como estão.`,
      );
      if (!seguir) return;
    }
  }
  // A ficha é conferida antes: serviço salvo com ficha recusada ficaria pela metade.
  if (
    fichaMudou() &&
    ficha.value.some((l) => !l.produtoId || !(Number(l.quantidade) > 0))
  ) {
    await negar('Cada linha da ficha técnica precisa de produto e quantidade.');
    return;
  }
  const salvo = await executar(async () => {
    const s = await api.servicos.salvar(form.value);
    // Serviço novo já criado: tentar de novo atualiza, não duplica.
    form.value = { ...form.value, id: s.id };
    if (fichaMudou())
      await api.fichas.salvar(s.id, JSON.parse(resumoDaFicha()));
    return s;
  });
  if (!salvo) return;
  notificar.sucesso(
    editando.value ? 'Serviço atualizado.' : `${salvo.nome} cadastrado.`,
  );
  aberto.value = false;
  emit('salvo');
}

async function excluir() {
  const id = props.id;
  if (id === null) return;
  const ok = await confirmar(`Excluir o serviço "${form.value.nome}"?`, {
    perigo: true,
    textoOk: 'Excluir',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await api.servicos.excluir(id), true),
  );
  if (!feito) return;
  notificar.sucesso('Serviço excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar serviço' : 'Novo serviço'"
    largura="sm"
  >
    <DsFormulario id="form-servico" @enviar="salvar">
      <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
      <DsSelect
        v-model="form.duracao"
        rotulo="Duração"
        :opcoes="duracoes"
        obrigatorio
      />
      <DsInputMoeda v-model="form.preco" rotulo="Preço" obrigatorio />
      <section v-if="comFicha" class="ficha" aria-label="Ficha técnica">
        <p class="ds-rotulo">Ficha técnica</p>
        <p class="ds-corpo-sm ds-suave">
          Consumíveis que saem do estoque a cada serviço pago.
        </p>
        <div v-for="(linha, i) in ficha" :key="i" class="ficha__linha">
          <template v-if="editaFicha">
            <DsSelect
              v-model="linha.produtoId"
              rotulo="Consumível"
              :opcoes="opcoesConsumiveis"
            />
            <DsInput
              v-model="linha.quantidade"
              tipo="numero"
              rotulo="Quantidade"
            />
            <DsBotao
              variante="fantasma"
              tamanho="sm"
              @click="ficha.splice(i, 1)"
            >
              Remover
            </DsBotao>
          </template>
          <span v-else
            >{{ linha.quantidade }} {{ linha.unidade }} · {{ linha.nome }}</span
          >
          <p v-if="linha.valido === false" class="ds-corpo-sm ficha__aviso">
            “{{ linha.nome }}” não é mais um consumível ativo: a linha é
            ignorada na baixa.
          </p>
        </div>
        <p v-if="!ficha.length" class="ds-corpo-sm ds-suave">
          Sem ficha técnica.
        </p>
        <DsBotao
          v-if="editaFicha"
          variante="secundario"
          tamanho="sm"
          @click="ficha.push({ produtoId: null, quantidade: 1 })"
        >
          Incluir consumível
        </DsBotao>
      </section>
    </DsFormulario>
    <template #acoes>
      <DsBotao
        v-if="editando"
        variante="perigo"
        class="acao-excluir"
        @click="excluir"
      >
        Excluir
      </DsBotao>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao formulario="form-servico">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.acao-excluir {
  margin-inline-end: auto;
}
.ficha {
  display: grid;
  gap: var(--esp-2);
}
.ficha p {
  margin: 0;
}
.ficha__linha {
  display: grid;
  gap: var(--esp-2);
  padding: var(--esp-2);
  border: 1px solid var(--linha);
  border-radius: var(--raio-sm);
}
.ficha__aviso {
  color: var(--perigo);
}
</style>
