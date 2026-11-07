<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsCartao, DsIcone, DsPagina, DsTabela } from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import { api } from '../../dados/api.js';
import ServicoDialogo from './ServicoDialogo.vue';
import BarbeiroDialogo from './BarbeiroDialogo.vue';

const servicos = ref([]);
const barbeiros = ref([]);
const servicoAberto = ref(false);
const barbeiroAberto = ref(false);
const servicoId = ref(null);
const barbeiroId = ref(null);

const colunasServicos = [
  { campo: 'nome', titulo: 'Serviço', ordenavel: true },
  {
    campo: 'duracao',
    titulo: 'Duração',
    alinhamento: 'centro',
    formatar: (v) => `${v} min`,
  },
  {
    campo: 'preco',
    titulo: 'Preço',
    alinhamento: 'fim',
    formatar: formatarMoeda,
  },
];
const colunasBarbeiros = [
  { campo: 'nome', titulo: 'Barbeiro', ordenavel: true },
  {
    campo: 'inicio',
    titulo: 'Expediente',
    formatar: (v, b) => `${b.inicio}–${b.fim}`,
  },
  {
    campo: 'comissao',
    titulo: 'Comissão',
    alinhamento: 'fim',
    formatar: (v) => `${v}%`,
  },
];

async function carregar() {
  [servicos.value, barbeiros.value] = await Promise.all([
    api.servicos.listar(),
    api.barbeiros.listar(),
  ]);
}
onMounted(carregar);

function abrirServico(id = null) {
  servicoId.value = id;
  servicoAberto.value = true;
}
function abrirBarbeiro(id = null) {
  barbeiroId.value = id;
  barbeiroAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Serviços e equipe">
    <div class="cartoes">
      <DsCartao titulo="Serviços">
        <template #cabecalho-acoes>
          <DsBotao tamanho="sm" @click="abrirServico()">
            <DsIcone nome="adicionar" tamanho="sm" />
            Novo serviço
          </DsBotao>
        </template>
        <DsTabela
          :colunas="colunasServicos"
          :linhas="servicos"
          texto-vazio="Nenhum serviço cadastrado"
          @selecionar="(s) => abrirServico(s.id)"
        />
      </DsCartao>

      <DsCartao titulo="Equipe">
        <template #cabecalho-acoes>
          <DsBotao tamanho="sm" @click="abrirBarbeiro()">
            <DsIcone nome="adicionar" tamanho="sm" />
            Novo barbeiro
          </DsBotao>
        </template>
        <DsTabela
          :colunas="colunasBarbeiros"
          :linhas="barbeiros"
          texto-vazio="Nenhum barbeiro cadastrado"
          @selecionar="(b) => abrirBarbeiro(b.id)"
        />
      </DsCartao>
    </div>

    <ServicoDialogo :id="servicoId" v-model="servicoAberto" @salvo="carregar" />
    <BarbeiroDialogo
      :id="barbeiroId"
      v-model="barbeiroAberto"
      @salvo="carregar"
    />
  </DsPagina>
</template>

<style scoped>
.cartoes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
  gap: var(--esp-4);
  align-items: start;
}
</style>
