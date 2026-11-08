<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  DsBotao,
  DsCartao,
  DsPagina,
  DsSelo,
  DsTabela,
  useNotificacao,
} from '@barbertime/ui';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import { plataforma } from '../dados/plataforma.js';
import AcaoDialogo from './AcaoDialogo.vue';
import { ACOES_DE_AUDITORIA, ESTADOS_DE_MODULO, SELOS } from './rotulos.js';

// Painel da barbearia no Business Center (planejamento 0028): números do mês
// contra o anterior, sem dado pessoal de cliente, e as ações do operador.
const props = defineProps({ id: { type: Number, required: true } });
const notificar = useNotificacao();

const p = ref(null);
const erro = ref('');
const salvando = ref(false);
const acao = ref(null);
const dialogo = ref(false);

async function carregar() {
  try {
    p.value = await plataforma.barbearia(props.id);
    erro.value = '';
  } catch (e) {
    erro.value = e.message;
  }
}
onMounted(carregar);

const selo = computed(() => (p.value ? SELOS[p.value.barbearia.selo] : null));

const variacaoTexto = (v) =>
  v === null || v === undefined
    ? 'sem base no mês anterior'
    : `${v > 0 ? '+' : ''}${String(v).replace('.', ',')}% vs mês anterior`;
const tendencia = (v) => (v > 0 ? 'sobe' : v < 0 ? 'cai' : 'igual');

const indicadores = computed(() => {
  if (!p.value) return [];
  const { faturamento, atendimentos, ticketMedio } = p.value;
  return [
    {
      titulo: 'Faturamento',
      valor: formatarMoeda(faturamento.atual),
      ...faturamento,
    },
    {
      titulo: 'Atendimentos pagos',
      valor: String(atendimentos.atual),
      ...atendimentos,
    },
    {
      titulo: 'Ticket médio',
      valor: formatarMoeda(ticketMedio.atual),
      ...ticketMedio,
    },
  ];
});

const maiorDia = computed(() =>
  Math.max(1, ...(p.value?.porDia ?? []).map((d) => d.valor)),
);

const porPapel = computed(() => {
  const contagem = new Map();
  for (const u of p.value?.usuarios ?? [])
    if (u.ativo)
      contagem.set(u.papelNome, (contagem.get(u.papelNome) ?? 0) + 1);
  return [...contagem.entries()];
});

const colunasRanking = [
  { campo: 'nome', titulo: 'Item' },
  { campo: 'quantidade', titulo: 'Qtd.', alinhamento: 'fim' },
  {
    campo: 'valor',
    titulo: 'Valor',
    alinhamento: 'fim',
    formatar: (v) => formatarMoeda(v),
  },
];
const colunasModulos = [
  { campo: 'nome', titulo: 'Módulo' },
  {
    campo: 'tipo',
    titulo: 'Tipo',
    formatar: (v) => (v === 'adicional' ? 'Adicional' : 'Incluso'),
  },
  { campo: 'estado', titulo: 'Estado' },
  { campo: 'acoes', titulo: '', alinhamento: 'fim' },
];
const colunasAuditoria = [
  {
    campo: 'criadaEm',
    titulo: 'Quando',
    formatar: (v) => new Date(v).toLocaleString('pt-BR'),
  },
  { campo: 'operadorNome', titulo: 'Operador' },
  {
    campo: 'acao',
    titulo: 'Ação',
    formatar: (v, l) =>
      `${ACOES_DE_AUDITORIA[v] ?? v}${l.dados?.chave ? ` (${l.dados.chave})` : ''}`,
  },
  { campo: 'motivo', titulo: 'Motivo', formatar: (v) => v ?? '—' },
];

const donoAtual = computed(() =>
  p.value?.usuarios.find((u) => u.papelChave === 'dono'),
);
const candidatos = computed(() =>
  (p.value?.usuarios ?? [])
    .filter((u) => u.ativo && u.papelChave !== 'dono')
    .map((u) => ({
      valor: u.id,
      rotulo: `${u.nome} (${u.papelNome}) · ${u.email}`,
    })),
);

function abrir(tipo, extra = {}) {
  const b = p.value.barbearia;
  const nomes = {
    suspender: {
      titulo: `Suspender ${b.nome}`,
      descricao:
        'Ninguém da barbearia entra, as sessões abertas caem e a página pública sai do ar. Os dados ficam guardados.',
      textoOk: 'Suspender',
      perigo: true,
    },
    reativar: { titulo: `Reativar ${b.nome}`, textoOk: 'Reativar' },
    dono: {
      titulo: 'Transferir o Dono',
      descricao: `${donoAtual.value?.nome ?? 'O Dono atual'} passa a Gerente. O novo Dono precisa ter acesso ativo nesta barbearia.`,
      textoOk: 'Transferir',
      perigo: true,
      pessoas: candidatos.value,
    },
    modulo: {
      titulo: `${{ confirmar_contratacao: 'Confirmar contratação', ativar: 'Ativar', desativar: 'Desativar' }[extra.acao]}: ${extra.modulo?.nome}`,
      textoOk: 'Confirmar',
      perigo: extra.acao === 'desativar',
    },
  };
  acao.value = { tipo, ...extra, ...nomes[tipo] };
  dialogo.value = true;
}

async function executar({ motivo, usuarioId }) {
  const a = acao.value;
  salvando.value = true;
  try {
    if (a.tipo === 'suspender') await plataforma.suspender(props.id, motivo);
    else if (a.tipo === 'reativar') await plataforma.reativar(props.id, motivo);
    else if (a.tipo === 'dono')
      await plataforma.transferirDono(props.id, usuarioId, motivo);
    else await plataforma.modulo(props.id, a.modulo.chave, a.acao, motivo);
    notificar.sucesso('Feito. A ação foi registrada no histórico.');
    dialogo.value = false;
    await carregar();
  } catch (e) {
    notificar.erro(e.message);
  } finally {
    salvando.value = false;
  }
}

const acoesDoModulo = (m) =>
  m.estado === 'solicitado'
    ? [
        ['confirmar_contratacao', 'Confirmar'],
        ['desativar', 'Recusar'],
      ]
    : m.estado === 'ativo'
      ? [['desativar', 'Desativar']]
      : [['ativar', 'Ativar']];
</script>

<template>
  <DsPagina
    :titulo="p?.barbearia.nome ?? 'Barbearia'"
    :sobretitulo="
      p
        ? `/${p.barbearia.slug} · desde ${formatarData(p.barbearia.criadaEm)}`
        : 'Business Center'
    "
  >
    <template v-if="p" #acoes>
      <DsBotao variante="secundario" @click="abrir('dono')"
        >Transferir Dono</DsBotao
      >
      <DsBotao v-if="p.barbearia.suspensaEm" @click="abrir('reativar')"
        >Reativar</DsBotao
      >
      <DsBotao v-else variante="perigo" @click="abrir('suspender')"
        >Suspender</DsBotao
      >
    </template>

    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    <template v-if="p">
      <div class="situacao">
        <DsSelo :estado="selo.estado">{{ selo.rotulo }}</DsSelo>
        <span v-if="p.barbearia.suspensaEm" class="ds-corpo-sm">
          Suspensa em {{ formatarData(p.barbearia.suspensaEm) }}:
          {{ p.barbearia.motivoSuspensao }}
        </span>
        <span class="ds-corpo-sm ds-suave">
          Dono: {{ donoAtual?.nome ?? '—' }} · {{ donoAtual?.email }}
        </span>
      </div>

      <section class="grade grade--indicadores" aria-label="Indicadores do mês">
        <DsCartao v-for="i in indicadores" :key="i.titulo" :titulo="i.titulo">
          <p class="ds-display">{{ i.valor }}</p>
          <p :class="['variacao', `variacao--${tendencia(i.variacao)}`]">
            {{ variacaoTexto(i.variacao) }}
          </p>
        </DsCartao>
        <DsCartao titulo="Clientes">
          <p class="ds-display">{{ p.clientes.total }}</p>
          <p class="ds-corpo-sm ds-suave">
            {{ p.clientes.novos }} novos · {{ p.clientes.atendidos }} atendidos
            no mês
          </p>
        </DsCartao>
        <DsCartao titulo="Agendamentos do mês">
          <p class="ds-display">{{ p.agendamentos.marcados }}</p>
          <p class="ds-corpo-sm ds-suave">
            {{ p.agendamentos.noShow }} faltas ·
            {{ p.agendamentos.cancelados }} cancelados
          </p>
        </DsCartao>
        <DsCartao titulo="Caixa atual">
          <template v-if="p.caixa">
            <p class="ds-display">{{ formatarMoeda(p.caixa.totalRecebido) }}</p>
            <p class="ds-corpo-sm ds-suave">
              Aberto em {{ formatarData(`${p.caixa.data}T12:00:00`) }} às
              {{ p.caixa.abertoAs }} · {{ p.caixa.pagas }} pagas,
              {{ p.caixa.abertas }} abertas ·
              {{ formatarMoeda(p.caixa.dinheiroEsperado) }} em dinheiro
            </p>
          </template>
          <p v-else class="ds-corpo-sm ds-suave">Caixa fechado.</p>
        </DsCartao>
      </section>

      <DsCartao titulo="Faturamento por dia">
        <p v-if="!p.porDia.length" class="ds-corpo-sm ds-suave">
          Nenhuma venda neste mês.
        </p>
        <ol v-else class="barras" aria-label="Faturamento por dia do mês">
          <li v-for="d in p.porDia" :key="d.data" class="barras__dia">
            <span
              class="barras__barra"
              :style="{
                blockSize: `${Math.max(4, (d.valor / maiorDia) * 100)}%`,
              }"
            />
            <span class="barras__rotulo">{{ d.data.slice(8) }}</span>
            <span class="sr-only"
              >{{ formatarData(`${d.data}T12:00:00`) }}:
              {{ formatarMoeda(d.valor) }}</span
            >
          </li>
        </ol>
      </DsCartao>

      <section class="grade grade--metade">
        <DsCartao titulo="Top 5 serviços">
          <DsTabela
            :linhas="p.topServicos"
            :colunas="colunasRanking"
            chave="nome"
            sem-rodape
            compacta
            texto-vazio="Nenhum serviço vendido no mês"
          />
        </DsCartao>
        <DsCartao titulo="Top 5 produtos">
          <DsTabela
            :linhas="p.topProdutos"
            :colunas="colunasRanking"
            chave="nome"
            sem-rodape
            compacta
            texto-vazio="Nenhum produto vendido no mês"
          />
        </DsCartao>
      </section>

      <section class="grade grade--metade">
        <DsCartao titulo="Módulos">
          <DsTabela
            :linhas="p.modulos"
            :colunas="colunasModulos"
            chave="chave"
            sem-rodape
            compacta
          >
            <template #celula-estado="{ valor }">
              <DsSelo :estado="ESTADOS_DE_MODULO[valor].estado">{{
                ESTADOS_DE_MODULO[valor].rotulo
              }}</DsSelo>
            </template>
            <template #celula-acoes="{ linha }">
              <span class="acoes">
                <DsBotao
                  v-for="[a, rotulo] in acoesDoModulo(linha)"
                  :key="a"
                  tamanho="sm"
                  :variante="
                    a === 'confirmar_contratacao' ? 'primario' : 'fantasma'
                  "
                  @click="abrir('modulo', { acao: a, modulo: linha })"
                  >{{ rotulo }}</DsBotao
                >
              </span>
            </template>
          </DsTabela>
        </DsCartao>
        <DsCartao titulo="Equipe">
          <ul class="papeis">
            <li v-for="[papel, qtd] in porPapel" :key="papel">
              <span>{{ papel }}</span
              ><strong>{{ qtd }}</strong>
            </li>
          </ul>
        </DsCartao>
      </section>

      <DsCartao titulo="Histórico de ações">
        <DsTabela
          :linhas="p.auditoria"
          :colunas="colunasAuditoria"
          compacta
          texto-vazio="Nenhuma ação registrada"
        />
      </DsCartao>
    </template>

    <AcaoDialogo
      v-if="acao"
      v-model="dialogo"
      :titulo="acao.titulo"
      :descricao="acao.descricao"
      :texto-ok="acao.textoOk"
      :perigo="acao.perigo"
      :pessoas="acao.pessoas ?? null"
      :salvando="salvando"
      @confirmar="executar"
    />
  </DsPagina>
</template>

<style scoped>
.situacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-3);
  margin-block-end: var(--esp-4);
}
.grade {
  display: grid;
  gap: var(--esp-4);
  margin-block: var(--esp-4);
}
.grade--indicadores {
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
}
.grade--metade {
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
}
.grade p {
  margin: 0;
}
.variacao {
  font: var(--tipo-corpo-sm);
  color: var(--grafite-suave);
}
.variacao--sobe {
  color: var(--sucesso);
}
.variacao--cai {
  color: var(--perigo);
}
.barras {
  display: flex;
  align-items: flex-end;
  gap: var(--esp-1);
  block-size: 10rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.barras__dia {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  block-size: 100%;
  min-inline-size: 0;
}
.barras__barra {
  inline-size: 100%;
  max-inline-size: 2rem;
  border-radius: var(--raio-sm) var(--raio-sm) 0 0;
  background: var(--cobre);
}
.barras__rotulo {
  font: var(--tipo-corpo-sm);
  color: var(--grafite-suave);
}
.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.acoes {
  display: inline-flex;
  gap: var(--esp-1);
}
.papeis {
  display: grid;
  gap: var(--esp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.papeis li {
  display: flex;
  justify-content: space-between;
}
.erro {
  color: var(--perigo);
}
</style>
