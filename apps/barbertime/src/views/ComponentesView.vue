<script setup lang="ts">
import { ref } from 'vue';
import {
  DsAbas,
  DsAcao,
  DsEscolha,
  DsBlocoAgenda,
  DsBotao,
  DsCartao,
  DsDialogo,
  DsHorarios,
  DsIcone,
  DsInput,
  DsInputCpf,
  DsInputMoeda,
  DsInputTelefone,
  DsPassos,
  DsSelect,
  DsSelo,
  DsTabela,
  NOMES_DE_ICONES,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { formatarMoeda } from '@barbertime/ui-utils';
import type { ColunaDaTabela, EstadoVisual } from '@barbertime/ui';

// Vitrine do kit base (substitui o catálogo enquanto ele não existe).
const notificar = useNotificacao();
const { confirmar, advertir, negar } = useDialogo();

const nome = ref('');
const servico = ref(null);
const dialogoAberto = ref(false);
const telefone = ref('11987654321');
const cpf = ref(null);
const preco = ref(45.9);
const horario = ref('10:00');
const abaVitrine = ref('servico');
const passoVitrine = ref(1);
const forma = ref('pix');
const formas = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'credito', rotulo: 'Crédito' },
];

const horarios = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
].map((hora, i) => ({ hora, disponivel: ![1, 4].includes(i) }));
const blocos: {
  cliente: string;
  servico?: string;
  inicio: string;
  fim: string;
  estado: EstadoVisual;
}[] = [
  {
    cliente: 'Rafael Souza',
    servico: 'Corte + barba',
    inicio: '09:00',
    fim: '09:50',
    estado: 'confirmado',
  },
  {
    cliente: 'Bruno Lima',
    servico: 'Corte',
    inicio: '10:00',
    fim: '10:30',
    estado: 'pendente',
  },
  {
    cliente: 'Diego Alves',
    servico: 'Barba (plano)',
    inicio: '10:30',
    fim: '10:50',
    estado: 'assinante',
  },
  {
    cliente: 'Encaixe da fila',
    servico: 'Corte',
    inicio: '11:00',
    fim: '11:30',
    estado: 'encaixe',
  },
  { cliente: 'Almoço', inicio: '12:00', fim: '13:00', estado: 'bloqueado' },
];

const servicos = [
  { valor: 'corte', rotulo: 'Corte' },
  { valor: 'barba', rotulo: 'Barba' },
  { valor: 'combo', rotulo: 'Corte + barba' },
];
const colunas: ColunaDaTabela<LinhaDeExemplo>[] = [
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
type LinhaDeExemplo = {
  id: number;
  servico: string;
  duracao: number;
  preco: number;
};
const linhas: LinhaDeExemplo[] = [
  { id: 1, servico: 'Corte', duracao: 30, preco: 45 },
  { id: 2, servico: 'Barba', duracao: 20, preco: 30 },
  { id: 3, servico: 'Corte + barba', duracao: 50, preco: 70 },
];

async function demoConfirmar() {
  const ok = await confirmar('Confirmar a presença de Rafael às 10:20?');
  notificar.info(ok ? 'Confirmado' : 'Cancelado');
}
async function demoAdvertir() {
  const ok = await advertir(
    'Bruno faltou 2 vezes este mês. Agendar mesmo assim?',
    {
      textoOk: 'Agendar mesmo assim',
    },
  );
  notificar.info(ok ? 'Seguiu mesmo com a advertência' : 'Voltou');
}
async function demoNegar() {
  await negar('Esse horário acabou de ser ocupado. Escolha outro.');
}

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
      <DsBotao variante="fantasma" tamanho="sm" denso>
        <DsIcone nome="adicionar" rotulo="Denso (só ícone)" />
      </DsBotao>
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

    <h2 class="ds-subtitulo">Campos brasileiros</h2>
    <div class="formulario">
      <DsInputTelefone v-model="telefone" obrigatorio />
      <DsInputCpf v-model="cpf" />
      <DsInputMoeda v-model="preco" rotulo="Preço do serviço" />
    </div>
    <p class="ds-corpo-sm ds-suave">
      Modelo: telefone <span class="ds-valor">{{ telefone ?? '—' }}</span> · CPF
      <span class="ds-valor">{{ cpf ?? '—' }}</span> · preço
      <span class="ds-valor">{{ preco ?? '—' }}</span>
    </p>

    <h2 class="ds-subtitulo">Selos</h2>
    <div class="linha">
      <DsSelo estado="confirmado" />
      <DsSelo estado="pendente" />
      <DsSelo estado="assinante" />
      <DsSelo estado="fila">3 na fila</DsSelo>
      <DsSelo estado="faltou" />
      <DsSelo>Neutro</DsSelo>
    </div>

    <h2 class="ds-subtitulo">Horários</h2>
    <DsHorarios
      v-model="horario"
      :opcoes="horarios"
      rotulo="Horários de sábado"
    />

    <h2 class="ds-subtitulo">Agenda</h2>
    <div class="blocos">
      <DsBlocoAgenda
        v-for="b in blocos"
        :key="b.inicio"
        v-bind="b"
        :clicavel="b.estado !== 'bloqueado'"
        @selecionar="notificar.info(`Abrir ${b.cliente}`)"
      />
    </div>

    <h2 class="ds-subtitulo">Cartão</h2>
    <DsCartao titulo="Caixa de hoje">
      <p class="ds-rotulo">Faturamento</p>
      <p class="ds-display">R$ 1.284</p>
      <template #acoes>
        <DsBotao variante="secundario" tamanho="sm">Ver comandas</DsBotao>
        <DsBotao tamanho="sm">Fechar caixa</DsBotao>
      </template>
    </DsCartao>

    <h2 class="ds-subtitulo">Ícones</h2>
    <div class="icones">
      <span v-for="icone in NOMES_DE_ICONES" :key="icone" class="icones__item">
        <DsIcone :nome="icone" tamanho="lg" />
        <span class="ds-corpo-sm">{{ icone }}</span>
      </span>
    </div>

    <h2 class="ds-subtitulo">Tabela</h2>
    <DsTabela
      :colunas="colunas"
      :linhas="linhas"
      @selecionar="(l) => notificar.info(`Selecionado: ${l.servico}`)"
    />

    <h2 class="ds-subtitulo">Abas</h2>
    <DsAbas
      v-model="abaVitrine"
      :abas="[
        { valor: 'servico', rotulo: 'Serviços (2)' },
        { valor: 'produto', rotulo: 'Produtos (1)' },
      ]"
      rotulo="Exemplo de abas"
    >
      <template #servico><p>Corte, Barba</p></template>
      <template #produto><p>Pomada modeladora</p></template>
    </DsAbas>

    <h2 class="ds-subtitulo">Etapas (stepper)</h2>
    <DsPassos
      v-model="passoVitrine"
      :passos="[
        { rotulo: 'Serviço' },
        { rotulo: 'Barbeiro' },
        { rotulo: 'Dia' },
        { rotulo: 'Horário' },
      ]"
    />

    <h2 class="ds-subtitulo">Escolha (estilo PDV)</h2>
    <DsEscolha v-model="forma" :opcoes="formas" rotulo="Forma de pagamento" />

    <h2 class="ds-subtitulo">Ações (estilo PDV)</h2>
    <div class="acoes-pdv">
      <DsAcao
        icone="check"
        titulo="Marcar atendido"
        descricao="Conclui o atendimento"
        variante="primario"
        @click="notificar.sucesso('Atendido')"
      />
      <DsAcao
        icone="caixa"
        titulo="Abrir comanda"
        descricao="Lança serviço e produtos no caixa"
        @click="notificar.info('Comanda')"
      />
      <DsAcao
        icone="alerta"
        titulo="Marcar falta"
        descricao="Fica no histórico do cliente"
        variante="perigo"
        @click="notificar.aviso('Falta')"
      />
      <DsAcao
        icone="bloqueio"
        titulo="Indisponível"
        descricao="Exemplo desabilitado"
        desabilitado
      />
    </div>

    <h2 class="ds-subtitulo">Confirmação, advertência e negação</h2>
    <div class="linha">
      <DsBotao variante="secundario" @click="demoConfirmar"
        >Confirmação</DsBotao
      >
      <DsBotao variante="secundario" @click="demoAdvertir">Advertência</DsBotao>
      <DsBotao variante="secundario" @click="demoNegar">Negação</DsBotao>
    </div>

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
.acoes-pdv {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--esp-2);
}
.blocos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: var(--esp-2);
}
.icones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: var(--esp-2);
}
.icones__item {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
  color: var(--grafite);
}
</style>
