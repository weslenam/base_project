<script setup lang="ts">
import { ref, watch } from 'vue';
import { DsDialogo, DsInput, DsSelo, DsTabela } from '@barbertime/ui';
import { formatarData, formatarTelefone } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { Cliente } from '../../dados/modelos.ts';

/** Lista completa de clientes para escolher um (planejamento 0012). */
const aberto = defineModel<boolean>({ default: false });
const emit = defineEmits<{ escolher: [cliente: Cliente] }>();

const busca = ref('');
const clientes = ref<Cliente[]>([]);
const carregando = ref(false);

const colunas: ColunaDaTabela<Cliente>[] = [
  { campo: 'nome', titulo: 'Cliente', ordenavel: true },
  { campo: 'telefone', titulo: 'Telefone', formatar: formatarTelefone },
  {
    campo: 'atendimentos',
    titulo: 'Atendimentos',
    alinhamento: 'centro',
    ordenavel: true,
  },
  {
    campo: 'ultimaVisita',
    titulo: 'Última visita',
    formatar: (v) => (v ? formatarData(v) : '—'),
  },
  { campo: 'faltas', titulo: 'Situação' },
];

async function carregar() {
  carregando.value = true;
  clientes.value = await api.clientes.listar({ busca: busca.value });
  carregando.value = false;
}

watch(aberto, (abriu) => {
  if (!abriu) return;
  busca.value = '';
  carregar();
});

let espera: ReturnType<typeof setTimeout> | undefined;
watch(busca, () => {
  clearTimeout(espera);
  espera = setTimeout(carregar, 200);
});

function escolher(cliente: Cliente) {
  emit('escolher', cliente);
  aberto.value = false;
}
</script>

<template>
  <DsDialogo v-model="aberto" titulo="Escolher cliente" largura="lg" fechavel>
    <div class="lista">
      <DsInput
        v-model="busca"
        rotulo="Buscar na lista"
        dica="Nome ou telefone"
      />
      <DsTabela
        :colunas="colunas"
        :linhas="clientes"
        :carregando="carregando"
        :itens-por-pagina="8"
        texto-vazio="Nenhum cliente encontrado"
        compacta
        @selecionar="escolher"
      >
        <template #celula-faltas="{ linha }">
          <DsSelo v-if="linha.faltas" estado="faltou">
            {{ linha.faltas }} {{ linha.faltas > 1 ? 'faltas' : 'falta' }}
          </DsSelo>
          <DsSelo v-else estado="confirmado">Em dia</DsSelo>
        </template>
      </DsTabela>
      <p class="ds-corpo-sm ds-suave">Clique no cliente para escolher.</p>
    </div>
  </DsDialogo>
</template>

<style scoped>
.lista {
  display: grid;
  gap: var(--esp-3);
}
.lista p {
  margin: 0;
}
</style>
