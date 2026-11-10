<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
  DsBotao,
  DsIcone,
  DsInput,
  DsPagina,
  DsSelo,
  DsTabela,
} from '@barbertime/ui';
import { formatarData, formatarTelefone } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import ClienteDialogo from './ClienteDialogo.vue';
import type { ColunaDaTabela } from '@barbertime/ui';
import type { Cliente } from '../../dados/modelos.ts';

const busca = ref('');
const clientes = ref<Cliente[]>([]);
const carregando = ref(false);
const dialogoAberto = ref(false);
const selecionadoId = ref<number | null>(null);

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
onMounted(carregar);

let espera: ReturnType<typeof setTimeout> | undefined;
watch(busca, () => {
  clearTimeout(espera);
  espera = setTimeout(carregar, 200);
});

function abrir(id: number | null = null) {
  selecionadoId.value = id;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Clientes" :sobretitulo="`${clientes.length} no cadastro`">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo cliente
      </DsBotao>
    </template>

    <div class="busca">
      <DsInput v-model="busca" rotulo="Buscar" dica="Nome ou telefone" />
    </div>

    <DsTabela
      :colunas="colunas"
      :linhas="clientes"
      :carregando="carregando"
      texto-vazio="Nenhum cliente encontrado"
      @selecionar="(c) => abrir(c.id)"
    >
      <template #celula-faltas="{ linha }">
        <DsSelo v-if="linha.faltas" estado="faltou">
          {{ linha.faltas }} {{ linha.faltas > 1 ? 'faltas' : 'falta' }}
        </DsSelo>
        <DsSelo v-else estado="confirmado">Em dia</DsSelo>
      </template>
    </DsTabela>

    <ClienteDialogo
      :id="selecionadoId"
      v-model="dialogoAberto"
      @salvo="carregar"
    />
  </DsPagina>
</template>

<style scoped>
.busca {
  max-width: 24rem;
}
</style>
