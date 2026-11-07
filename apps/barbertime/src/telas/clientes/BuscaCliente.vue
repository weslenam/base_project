<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
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

/**
 * Escolha de cliente no balcão pelo telefone (planejamento 0012):
 * digite parte do número (os últimos 4 já bastam) e toque no resultado;
 * número completo sem cadastro → cadastro rápido com o nome.
 */
const clienteId = defineModel({ type: [Number, null], default: null });
const props = defineProps({
  /** Mostra que dá para seguir sem cliente (comanda avulsa). */
  permitirAvulso: Boolean,
});
const emit = defineEmits(['selecionado']);

const notificar = useNotificacao();
const executar = useAcao();

const cliente = ref(null);
const telefone = ref(null);
const resultados = ref([]);
const nomeNovo = ref('');
const cadastrando = ref(false);

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

let ultimaBusca = 0;
watch(telefone, async (valor) => {
  const digitos = somenteDigitos(valor);
  const esta = ++ultimaBusca;
  if (digitos.length < 4) {
    resultados.value = [];
    return;
  }
  const achados = await api.clientes.listar({ busca: digitos });
  // Quem termina com os dígitos digitados vem primeiro ("os últimos 4 já bastam").
  const ordenados = [...achados].sort(
    (a, b) =>
      Number(b.telefone.endsWith(digitos)) -
      Number(a.telefone.endsWith(digitos)),
  );
  if (esta === ultimaBusca) resultados.value = ordenados.slice(0, 5);
});

const digitos = computed(() => somenteDigitos(telefone.value));
const numeroCompletoSemCadastro = computed(
  () =>
    validarTelefone(digitos.value) &&
    !resultados.value.some((c) => c.telefone === digitos.value),
);

function escolher(c) {
  cliente.value = c;
  clienteId.value = c.id;
  telefone.value = null;
  resultados.value = [];
  nomeNovo.value = '';
}

function trocar() {
  cliente.value = null;
  clienteId.value = null;
}

async function cadastrar() {
  cadastrando.value = true;
  const novo = await executar(() =>
    api.clientes.salvar({ nome: nomeNovo.value, telefone: digitos.value }),
  );
  cadastrando.value = false;
  if (!novo) return;
  notificar.sucesso(`${novo.nome} cadastrado.`);
  escolher(await api.clientes.obter(novo.id));
}
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

    <!-- Busca pelo telefone -->
    <template v-else>
      <DsInputTelefone
        v-model="telefone"
        rotulo="Telefone do cliente"
        :validar-numero="false"
        :ajuda="
          permitirAvulso
            ? 'Sem cliente, a comanda fica como avulso'
            : 'Os últimos 4 dígitos já bastam'
        "
      />

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
        v-if="numeroCompletoSemCadastro"
        class="novo"
        role="group"
        aria-label="Cadastro rápido"
      >
        <p class="ds-corpo-sm">
          Nenhum cliente com o telefone
          <span class="ds-valor">{{ formatarTelefone(digitos) }}</span
          >. Cadastre agora:
        </p>
        <div class="novo__campos">
          <DsInput v-model="nomeNovo" rotulo="Nome do cliente" />
          <DsBotao
            :desabilitado="!nomeNovo.trim()"
            :carregando="cadastrando"
            @click="cadastrar"
          >
            Cadastrar e usar
          </DsBotao>
        </div>
      </div>
      <p
        v-else-if="digitos.length >= 4 && !resultados.length"
        class="ds-corpo-sm ds-suave"
      >
        Nenhum cliente encontrado. Digite o número completo para cadastrar.
      </p>
    </template>
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
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--esp-2);
}
</style>
