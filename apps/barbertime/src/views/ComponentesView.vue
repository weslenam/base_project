<script setup>
import { ref } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsInput,
  DsSelect,
  DsTabela,
  useConfirmacao,
  useNotificacao,
} from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';

// Vitrine do kit base (substitui o catálogo enquanto ele não existe).
const notificar = useNotificacao();
const confirmar = useConfirmacao();

const nome = ref('');
const servico = ref(null);
const dialogoAberto = ref(false);

const servicos = [
  { valor: 'corte', rotulo: 'Corte' },
  { valor: 'barba', rotulo: 'Barba' },
  { valor: 'combo', rotulo: 'Corte + barba' },
];
const colunas = [
  { campo: 'servico', titulo: 'Serviço', ordenavel: true },
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
const linhas = [
  { id: 1, servico: 'Corte', duracao: 30, preco: 45 },
  { id: 2, servico: 'Barba', duracao: 20, preco: 30 },
  { id: 3, servico: 'Corte + barba', duracao: 50, preco: 70 },
];

async function excluir() {
  if (
    await confirmar('Excluir este agendamento?', {
      textoOk: 'Excluir',
      perigo: true,
    })
  ) {
    notificar.sucesso('Agendamento excluído');
  } else {
    notificar.info('Nada foi excluído');
  }
}
</script>

<template>
  <section class="pagina">
    <h1 class="ds-titulo">Componentes</h1>

    <h2 class="ds-subtitulo">Botões</h2>
    <div class="linha">
      <DsBotao @click="notificar.sucesso('Tudo certo!')">Primário</DsBotao>
      <DsBotao variante="secundario" @click="notificar.aviso('Atenção a isto')"
        >Secundário</DsBotao
      >
      <DsBotao variante="perigo" @click="excluir">Perigo (confirma)</DsBotao>
      <DsBotao carregando>Carregando</DsBotao>
      <DsBotao variante="fantasma" @click="notificar.info('Ação discreta')"
        >Fantasma</DsBotao
      >
      <DsBotao desabilitado>Desabilitado</DsBotao>
    </div>

    <h2 class="ds-subtitulo">Formulário</h2>
    <div class="formulario">
      <DsInput
        v-model="nome"
        rotulo="Nome do cliente"
        obrigatorio
        ajuda="Como aparece na agenda"
      />
      <DsSelect
        v-model="servico"
        rotulo="Serviço"
        :opcoes="servicos"
        limpavel
      />
    </div>

    <h2 class="ds-subtitulo">Tabela</h2>
    <DsTabela
      :colunas="colunas"
      :linhas="linhas"
      @selecionar="(l) => notificar.info(`Selecionado: ${l.servico}`)"
    />

    <h2 class="ds-subtitulo">Diálogo</h2>
    <DsBotao variante="secundario" @click="dialogoAberto = true"
      >Abrir diálogo</DsBotao
    >
    <DsDialogo v-model="dialogoAberto" titulo="Novo agendamento">
      Conteúdo do diálogo.
      <template #acoes>
        <DsBotao variante="secundario" @click="dialogoAberto = false"
          >Fechar</DsBotao
        >
      </template>
    </DsDialogo>
  </section>
</template>

<style scoped>
.pagina {
  padding: var(--esp-6) var(--esp-4);
  display: grid;
  gap: var(--esp-4);
  max-width: 64rem;
}
.linha {
  display: flex;
  flex-wrap: wrap;
  gap: var(--esp-2);
}
.formulario {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--esp-4);
}
h2 {
  margin-top: var(--esp-4);
}
</style>
