<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsIcone,
  DsInput,
  DsInputTelefone,
  DsSelo,
  useNotificacao,
} from '@barbertime/ui';
import {
  formatarTelefone,
  somenteDigitos,
  validarTelefone,
} from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import { useAcao } from '../../dados/useAcao.js';
import ListaClientesDialogo from './ListaClientesDialogo.vue';

/**
 * Escolha de cliente no balcão (planejamento 0012): um campo para nome OU
 * telefone, resultados em botões, cadastro rápido quando não acha e a lista
 * completa para procurar com mais detalhes.
 */
const clienteId = defineModel({ type: [Number, null], default: null });
defineProps({
  /** Mostra que dá para seguir sem cliente (comanda avulsa). */
  permitirAvulso: Boolean,
});
const emit = defineEmits(['selecionado']);

const notificar = useNotificacao();
const executar = useAcao();

const cliente = ref(null);
const termo = ref('');
const resultados = ref([]);
const buscou = ref(false);
const novo = ref({ nome: '', telefone: null });
const cadastrando = ref(false);
const listaAberta = ref(false);

// Cliente já escolhido (ex.: comanda aberta a partir de agendamento).
watch(
  clienteId,
  async (id) => {
    if (!id) {
      cliente.value = null;
      return;
    }
    if (cliente.value?.id !== id) cliente.value = await api.clientes.obter(id);
    emit('selecionado', cliente.value);
  },
  { immediate: true },
);

/** Só números (e símbolos de telefone) = busca por telefone; com letras = por nome. */
const porTelefone = computed(
  () => !/[a-zà-ú]/i.test(termo.value) && somenteDigitos(termo.value) !== '',
);
const digitos = computed(() => somenteDigitos(termo.value));
const buscaValida = computed(() =>
  porTelefone.value
    ? digitos.value.length >= 4
    : termo.value.trim().length >= 2,
);

let ultimaBusca = 0;
watch(termo, async () => {
  const esta = ++ultimaBusca;
  if (!buscaValida.value) {
    resultados.value = [];
    buscou.value = false;
    return;
  }
  const achados = await api.clientes.listar({ busca: termo.value });
  const texto = termo.value.trim().toLowerCase();
  // Quem termina com os dígitos (telefone) ou começa com o texto (nome) vem primeiro.
  const prioridade = (c) =>
    porTelefone.value
      ? Number(c.telefone.endsWith(digitos.value))
      : Number(c.nome.toLowerCase().startsWith(texto));
  if (esta !== ultimaBusca) return;
  resultados.value = [...achados]
    .sort((a, b) => prioridade(b) - prioridade(a))
    .slice(0, 5);
  buscou.value = true;
});

// Nada encontrado: o que foi digitado já preenche o campo certo do cadastro.
const podeCadastrar = computed(
  () =>
    buscou.value &&
    !resultados.value.length &&
    (porTelefone.value ? validarTelefone(digitos.value) : true),
);
watch(podeCadastrar, (pode) => {
  if (!pode) return;
  novo.value = porTelefone.value
    ? { nome: '', telefone: digitos.value }
    : { nome: termo.value.trim(), telefone: null };
});

function escolher(c) {
  cliente.value = c;
  clienteId.value = c.id;
  termo.value = '';
  resultados.value = [];
}

function trocar() {
  cliente.value = null;
  clienteId.value = null;
}

async function cadastrar() {
  cadastrando.value = true;
  const salvo = await executar(() => api.clientes.salvar(novo.value));
  cadastrando.value = false;
  if (!salvo) return;
  notificar.sucesso(`${salvo.nome} cadastrado.`);
  escolher(await api.clientes.obter(salvo.id));
}

const cadastroCompleto = computed(
  () => novo.value.nome.trim() && validarTelefone(novo.value.telefone),
);
</script>

<template>
  <div class="busca-cliente">
    <!-- Cliente escolhido -->
    <div v-if="cliente" class="escolhido">
      <div class="escolhido__dados">
        <p class="ds-rotulo">Cliente</p>
        <p class="escolhido__nome">{{ cliente.nome }}</p>
        <p class="ds-valor ds-suave">
          {{ formatarTelefone(cliente.telefone) }}
        </p>
      </div>
      <DsSelo v-if="cliente.faltas" estado="faltou">
        {{ cliente.faltas }} {{ cliente.faltas > 1 ? 'faltas' : 'falta' }}
      </DsSelo>
      <DsBotao variante="fantasma" tamanho="sm" @click="trocar">Trocar</DsBotao>
    </div>

    <!-- Busca -->
    <template v-else>
      <div class="campo">
        <DsInput
          v-model="termo"
          rotulo="Nome ou telefone do cliente"
          :ajuda="
            permitirAvulso
              ? 'Sem cliente, a comanda fica como avulso'
              : 'Do telefone, os últimos 4 dígitos já bastam'
          "
        />
        <DsBotao variante="secundario" @click="listaAberta = true">
          <DsIcone nome="clientes" />
          Procurar na lista
        </DsBotao>
      </div>

      <ul
        v-if="resultados.length"
        class="resultados"
        aria-label="Clientes encontrados"
      >
        <li v-for="c in resultados" :key="c.id">
          <button type="button" class="resultado" @click="escolher(c)">
            <span class="resultado__nome">{{ c.nome }}</span>
            <span class="ds-valor ds-suave">{{
              formatarTelefone(c.telefone)
            }}</span>
          </button>
        </li>
      </ul>

      <div
        v-if="podeCadastrar"
        class="novo"
        role="group"
        aria-label="Cadastro rápido"
      >
        <p class="ds-corpo-sm">Nenhum cliente encontrado. Cadastre agora:</p>
        <div class="novo__campos">
          <DsInput v-model="novo.nome" rotulo="Nome do cliente" />
          <DsInputTelefone v-model="novo.telefone" rotulo="Telefone" />
          <DsBotao
            :desabilitado="!cadastroCompleto"
            :carregando="cadastrando"
            @click="cadastrar"
          >
            Cadastrar e usar
          </DsBotao>
        </div>
      </div>
      <p v-else-if="buscou && !resultados.length" class="ds-corpo-sm ds-suave">
        Nenhum cliente encontrado. Digite o telefone completo para cadastrar.
      </p>
    </template>

    <ListaClientesDialogo v-model="listaAberta" @escolher="escolher" />
  </div>
</template>

<style scoped>
.busca-cliente {
  display: grid;
  gap: var(--esp-2);
}
.busca-cliente p {
  margin: 0;
}
.campo {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: var(--esp-2);
}
.escolhido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-2) var(--esp-3);
  padding: var(--esp-2) var(--esp-3);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--cobre);
  border-radius: var(--raio-sm);
  background: var(--placa);
}
.escolhido__dados {
  display: grid;
  flex: 1;
  min-width: 10rem;
}
.escolhido__nome {
  font-weight: 600;
}
.resultados {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.resultado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esp-3);
  width: 100%;
  min-height: 44px;
  padding: var(--esp-2) var(--esp-3);
  border: 2px solid var(--linha-forte);
  border-radius: var(--raio-sm);
  background: var(--placa);
  color: var(--grafite);
  font: var(--tipo-corpo);
  text-align: left;
  cursor: pointer;
}
.resultado:hover {
  border-color: var(--cobre);
}
.resultado__nome {
  font-weight: 600;
}
.novo {
  display: grid;
  gap: var(--esp-2);
  padding: var(--esp-3);
  border: 1px dashed var(--linha-forte);
  border-radius: var(--raio-sm);
}
.novo__campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  align-items: center;
  gap: var(--esp-2);
}
</style>
