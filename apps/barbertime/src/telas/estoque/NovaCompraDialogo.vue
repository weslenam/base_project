<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsEscolha,
  DsInput,
  DsInputMoeda,
  DsSelect,
  DsTextarea,
  useNotificacao,
} from '@barbertime/ui';
import {
  dividirParcelas,
  hojeIso,
  somarDias,
  totalDaCompra,
} from '@barbertime/dominio';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';

// Nova compra (planejamento 0027): itens, frete, desconto e parcelas. As
// parcelas são sugeridas por dividirParcelas e podem ser editadas antes de salvar.
const aberto = defineModel({ type: Boolean, default: false });
const emit = defineEmits(['salvo']);

const notificar = useNotificacao();
const executar = useAcao();
const fornecedores = ref([]);
const produtos = ref([]);
const form = ref(null);
const parcelas = ref([]);

const FORMAS = [
  { valor: 'vista', rotulo: 'À vista' },
  { valor: 'parcelado', rotulo: 'Parcelado' },
];

const opcoesFornecedores = computed(() =>
  fornecedores.value.map((f) => ({ valor: f.id, rotulo: f.nome })),
);
const opcoesProdutos = computed(() =>
  produtos.value.map((p) => ({
    valor: p.id,
    rotulo: `${p.nome} (${p.unidade})`,
  })),
);

const total = computed(() => {
  if (!form.value) return 0;
  return totalDaCompra({
    itens: form.value.itens.map((i) => ({
      quantidade: Number(i.quantidade) || 0,
      custoUnitario: Number(i.custoUnitario) || 0,
    })),
    frete: form.value.frete || 0,
    desconto: form.value.desconto || 0,
  }).total;
});

watch(aberto, async (abriu) => {
  if (!abriu) return;
  form.value = null;
  [fornecedores.value, produtos.value] = await Promise.all([
    api.fornecedores.listar(),
    api.produtos.listar(),
  ]);
  const hoje = hojeIso();
  form.value = {
    fornecedorId: null,
    data: hoje,
    itens: [{ produtoId: null, quantidade: 1, custoUnitario: null }],
    frete: null,
    desconto: null,
    observacao: '',
    forma: 'vista',
    quantidade: 2,
    intervaloDias: 30,
    primeiroVencimento: hoje,
  };
});

// Sugestão das parcelas: refeita quando muda o total ou a forma de parcelar.
watch(
  () =>
    form.value && [
      total.value,
      form.value.forma,
      form.value.quantidade,
      form.value.intervaloDias,
      form.value.primeiroVencimento,
    ],
  () => {
    const f = form.value;
    if (!f) return;
    const vista = f.forma === 'vista';
    parcelas.value =
      total.value > 0
        ? dividirParcelas(total.value, vista ? 1 : Number(f.quantidade) || 1, {
            primeiroVencimento: f.primeiroVencimento || f.data,
            intervaloDias: Number(f.intervaloDias) || 30,
          })
        : [];
  },
  { deep: true },
);

watch(
  () => form.value?.forma,
  (forma) => {
    const f = form.value;
    if (f && forma === 'parcelado' && f.primeiroVencimento === f.data)
      f.primeiroVencimento = somarDias(f.data, Number(f.intervaloDias) || 30);
  },
);

function incluirItem() {
  form.value.itens.push({
    produtoId: null,
    quantidade: 1,
    custoUnitario: null,
  });
}

async function salvar() {
  const f = form.value;
  const salva = await executar(() =>
    api.compras.registrar({
      fornecedorId: f.fornecedorId,
      data: f.data,
      frete: f.frete || 0,
      desconto: f.desconto || 0,
      observacao: f.observacao,
      itens: f.itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: Number(i.quantidade),
        custoUnitario: Number(i.custoUnitario ?? 0),
      })),
      parcelas: parcelas.value.map((p) => ({
        valor: Number(p.valor),
        vencimento: p.vencimento,
      })),
    }),
  );
  if (!salva) return;
  notificar.sucesso(`Compra #${salva.id} registrada.`);
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Nova compra" largura="lg" fechavel>
    <div v-if="form" class="compra">
      <section class="coluna" aria-label="Dados da compra">
        <DsSelect
          v-model="form.fornecedorId"
          rotulo="Fornecedor"
          :opcoes="opcoesFornecedores"
          obrigatorio
        />
        <p v-if="!fornecedores.length" class="ds-corpo-sm ds-suave">
          Cadastre um fornecedor antes de lançar a compra.
        </p>
        <DsInput v-model="form.data" tipo="data" rotulo="Data da compra" />

        <p class="ds-rotulo">Produtos</p>
        <div v-for="(item, i) in form.itens" :key="i" class="item">
          <DsSelect
            v-model="item.produtoId"
            :rotulo="`Produto ${i + 1}`"
            :opcoes="opcoesProdutos"
          />
          <div class="item__valores">
            <DsInput
              v-model="item.quantidade"
              tipo="numero"
              :rotulo="`Quantidade ${i + 1}`"
            />
            <DsInputMoeda
              v-model="item.custoUnitario"
              :rotulo="`Custo unitário ${i + 1}`"
            />
          </div>
          <DsBotao
            v-if="form.itens.length > 1"
            variante="fantasma"
            tamanho="sm"
            @click="form.itens.splice(i, 1)"
          >
            Remover produto
          </DsBotao>
        </div>
        <DsBotao variante="secundario" tamanho="sm" @click="incluirItem">
          Incluir produto
        </DsBotao>
      </section>

      <section class="coluna" aria-label="Pagamento">
        <div class="item__valores">
          <DsInputMoeda v-model="form.frete" rotulo="Frete" />
          <DsInputMoeda v-model="form.desconto" rotulo="Desconto" />
        </div>
        <p class="total">
          <span class="ds-rotulo">Total</span>
          <span class="ds-valor">{{ formatarMoeda(total) }}</span>
        </p>

        <p class="ds-rotulo">Pagamento</p>
        <DsEscolha v-model="form.forma" :opcoes="FORMAS" rotulo="Pagamento" />
        <div v-if="form.forma === 'parcelado'" class="item__valores">
          <DsInput v-model="form.quantidade" tipo="numero" rotulo="Parcelas" />
          <DsInput
            v-model="form.intervaloDias"
            tipo="numero"
            rotulo="A cada (dias)"
          />
        </div>
        <DsInput
          v-model="form.primeiroVencimento"
          tipo="data"
          :rotulo="
            form.forma === 'vista' ? 'Vencimento' : 'Primeiro vencimento'
          "
        />

        <ul v-if="parcelas.length > 1" class="parcelas" aria-label="Parcelas">
          <li v-for="p in parcelas" :key="p.parcela" class="item__valores">
            <DsInputMoeda
              v-model="p.valor"
              :rotulo="`Parcela ${p.parcela}/${p.parcelas}`"
            />
            <DsInput
              v-model="p.vencimento"
              tipo="data"
              :rotulo="`Vencimento ${p.parcela}`"
            />
          </li>
        </ul>
        <DsTextarea v-model="form.observacao" rotulo="Observação" />
      </section>
    </div>
    <template #acoes>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao @click="salvar">Registrar compra</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.compra {
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
.item__valores {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: var(--esp-2);
}
.total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.parcelas {
  display: grid;
  gap: var(--esp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
