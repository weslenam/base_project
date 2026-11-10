<script setup>
import { computed, onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsTabela } from '@barbertime/ui';
import { formatarTelefone } from '@barbertime/ui-utils';
import { api } from '../../dados/api.ts';
import { pode } from '../../sessao/sessao.ts';
import FornecedorDialogo from './FornecedorDialogo.vue';

// Fornecedores (planejamento 0027, parte 1). Exclusão lógica.
const fornecedores = ref([]);
const dialogoAberto = ref(false);
const selecionado = ref(null);
const gerencia = computed(() => pode('estoque.gerenciar'));

const formatarDocumento = (d) => {
  if (!d) return '—';
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const colunas = [
  { campo: 'nome', titulo: 'Fornecedor', ordenavel: true },
  { campo: 'documento', titulo: 'CPF ou CNPJ', formatar: formatarDocumento },
  {
    campo: 'telefone',
    titulo: 'Telefone',
    formatar: (v) => (v ? formatarTelefone(v) : '—'),
  },
];

async function carregar() {
  fornecedores.value = await api.fornecedores.listar();
}
onMounted(carregar);

function abrir(f = null) {
  if (!gerencia.value) return;
  selecionado.value = f;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina
    titulo="Fornecedores"
    :sobretitulo="`${fornecedores.length} cadastrado${fornecedores.length === 1 ? '' : 's'}`"
  >
    <template v-if="gerencia" #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Novo fornecedor
      </DsBotao>
    </template>
    <DsTabela
      :colunas="colunas"
      :linhas="fornecedores"
      texto-vazio="Nenhum fornecedor cadastrado"
      @selecionar="abrir"
    />
    <FornecedorDialogo
      v-model="dialogoAberto"
      :fornecedor="selecionado"
      @salvo="carregar"
    />
  </DsPagina>
</template>
