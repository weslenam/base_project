<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  DsBotao,
  DsCartao,
  DsIndicador,
  DsPagina,
  DsSelo,
  DsTabela,
  useNotificacao,
} from '@barbertime/ui';
import type { ColunaDaTabela, OpcaoDeSelect } from '@barbertime/ui';
import { formatarData, formatarMoeda } from '@barbertime/ui-utils';
import { plataforma } from '../dados/plataforma.ts';
import type { AcaoDeModulo, Painel } from '../dados/plataforma.ts';
import AcaoDialogo from './AcaoDialogo.vue';
import { ACOES_DE_AUDITORIA, ESTADOS_DE_MODULO, SELOS } from './rotulos.ts';

type Modulo = Painel['modulos'][number];
type ItemDoRanking = Painel['topServicos'][number];
type Registro = Painel['auditoria'][number];
type EstadoDeModulo = keyof typeof ESTADOS_DE_MODULO;
type TipoDeAcao = 'suspender' | 'reativar' | 'dono' | 'modulo';

/** Ação aberta no diálogo, com os textos dele. */
interface AcaoAberta {
  tipo: TipoDeAcao;
  acao?: AcaoDeModulo;
  modulo?: Modulo;
  titulo: string;
  descricao?: string;
  textoOk: string;
  perigo?: boolean;
  pessoas?: OpcaoDeSelect[];
}

// Painel da barbearia no Business Center (planejamento 0028): números do mês
// contra o anterior, sem dado pessoal de cliente, e as ações do operador.
const props = defineProps({ id: { type: Number, required: true } });
const notificar = useNotificacao();

const p = ref<Painel | null>(null);
const erro = ref('');
const salvando = ref(false);
const acao = ref<AcaoAberta | null>(null);
const dialogo = ref(false);

async function carregar() {
  try {
    p.value = await plataforma.barbearia(props.id);
    erro.value = '';
  } catch (e) {
    erro.value = (e as Error).message;
  }
}
onMounted(carregar);

const selo = computed(() => (p.value ? SELOS[p.value.barbearia.selo] : null));

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
  const contagem = new Map<string, number>();
  for (const u of p.value?.usuarios ?? [])
    if (u.ativo)
      contagem.set(u.papelNome, (contagem.get(u.papelNome) ?? 0) + 1);
  return [...contagem.entries()];
});

const colunasRanking: ColunaDaTabela<ItemDoRanking>[] = [
  { campo: 'nome', titulo: 'Item' },
  { campo: 'quantidade', titulo: 'Qtd.', alinhamento: 'fim' },
  {
    campo: 'valor',
    titulo: 'Valor',
    alinhamento: 'fim',
    formatar: (v) => formatarMoeda(v as number),
  },
];
const colunasModulos: ColunaDaTabela<Modulo>[] = [
  { campo: 'nome', titulo: 'Módulo' },
  {
    campo: 'tipo',
    titulo: 'Tipo',
    formatar: (v) => (v === 'adicional' ? 'Adicional' : 'Incluso'),
  },
  { campo: 'estado', titulo: 'Estado' },
  { campo: 'acoes', titulo: '', alinhamento: 'fim' },
];
const colunasAuditoria: ColunaDaTabela<Registro>[] = [
  {
    campo: 'criadaEm',
    titulo: 'Quando',
    formatar: (v) => new Date(v as string).toLocaleString('pt-BR'),
  },
  { campo: 'operadorNome', titulo: 'Operador' },
  {
    campo: 'acao',
    titulo: 'Ação',
    formatar: (v, l) => {
      const chave = (l.dados as { chave?: string } | null)?.chave;
      return `${ACOES_DE_AUDITORIA[v as string] ?? v}${chave ? ` (${chave})` : ''}`;
    },
  },
  {
    campo: 'motivo',
    titulo: 'Motivo',
    formatar: (v) => (v as string | null) ?? '—',
  },
];

/** Selo do estado de um módulo; estado desconhecido aparece neutro, sem quebrar o painel. */
const seloDoModulo = (estado: unknown) =>
  ESTADOS_DE_MODULO[estado as EstadoDeModulo] ?? {
    rotulo: String(estado),
    estado: 'neutro' as const,
  };

const donoAtual = computed(() =>
  p.value?.usuarios.find((u) => u.papelChave === 'dono'),
);
const candidatos = computed<OpcaoDeSelect[]>(() =>
  (p.value?.usuarios ?? [])
    .filter((u) => u.ativo && u.papelChave !== 'dono')
    .map((u) => ({
      valor: u.id,
      rotulo: `${u.nome} (${u.papelNome}) · ${u.email}`,
    })),
);

const NOMES_DAS_ACOES: Record<AcaoDeModulo, string> = {
  confirmar_contratacao: 'Confirmar contratação',
  ativar: 'Ativar',
  desativar: 'Desativar',
};

function abrir(
  tipo: TipoDeAcao,
  extra: { acao?: AcaoDeModulo; modulo?: Modulo } = {},
) {
  if (!p.value) return;
  const b = p.value.barbearia;
  const nomes: Record<TipoDeAcao, Omit<AcaoAberta, 'tipo'>> = {
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
      titulo: `${extra.acao ? NOMES_DAS_ACOES[extra.acao] : undefined}: ${extra.modulo?.nome}`,
      textoOk: 'Confirmar',
      perigo: extra.acao === 'desativar',
    },
  };
  acao.value = { tipo, ...extra, ...nomes[tipo] };
  dialogo.value = true;
}

async function executar({
  motivo,
  usuarioId,
}: {
  motivo: string;
  usuarioId: number | null;
}) {
  const a = acao.value;
  if (!a) return;
  salvando.value = true;
  try {
    if (a.tipo === 'suspender') await plataforma.suspender(props.id, motivo);
    else if (a.tipo === 'reativar') await plataforma.reativar(props.id, motivo);
    else if (a.tipo === 'dono') {
      if (usuarioId === null) throw new Error('Escolha o novo Dono.');
      await plataforma.transferirDono(props.id, usuarioId, motivo);
    } else {
      if (!a.modulo || !a.acao) throw new Error('Ação de módulo incompleta.');
      await plataforma.modulo(props.id, a.modulo.chave, a.acao, motivo);
    }
    notificar.sucesso('Feito. A ação foi registrada no histórico.');
    dialogo.value = false;
    await carregar();
  } catch (e) {
    notificar.erro((e as Error).message);
  } finally {
    salvando.value = false;
  }
}

const acoesDoModulo = (m: Modulo): [AcaoDeModulo, string][] =>
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
        <DsSelo v-if="selo" :estado="selo.estado">{{ selo.rotulo }}</DsSelo>
        <span v-if="p.barbearia.suspensaEm" class="ds-corpo-sm">
          Suspensa em {{ formatarData(p.barbearia.suspensaEm) }}:
          {{ p.barbearia.motivoSuspensao }}
        </span>
        <span class="ds-corpo-sm ds-suave">
          Dono: {{ donoAtual?.nome ?? '—' }} · {{ donoAtual?.email }}
        </span>
      </div>

      <section class="grade grade--indicadores" aria-label="Indicadores do mês">
        <DsIndicador
          v-for="i in indicadores"
          :key="i.titulo"
          :rotulo="i.titulo"
          :valor="i.valor"
          :variacao="i.variacao"
          comparacao="mês anterior"
        />
        <DsIndicador
          rotulo="Clientes"
          :valor="p.clientes.total"
          :detalhe="`${p.clientes.novos} novos · ${p.clientes.atendidos} atendidos no mês`"
        />
        <DsIndicador
          rotulo="Agendamentos do mês"
          :valor="p.agendamentos.marcados"
          :detalhe="`${p.agendamentos.noShow} faltas · ${p.agendamentos.cancelados} cancelados`"
        />
        <DsIndicador
          rotulo="Caixa atual"
          :valor="p.caixa ? formatarMoeda(p.caixa.totalRecebido) : 'Fechado'"
          :detalhe="
            p.caixa
              ? `Aberto em ${formatarData(`${p.caixa.data}T12:00:00`)} às ${p.caixa.abertoAs} · ${p.caixa.pagas} pagas, ${p.caixa.abertas} abertas · ${formatarMoeda(p.caixa.dinheiroEsperado)} em dinheiro`
              : 'Nenhum caixa aberto.'
          "
        />
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
              <DsSelo :estado="seloDoModulo(valor).estado">{{
                seloDoModulo(valor).rotulo
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
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
}
.grade--metade {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}
/* Filhos da grade podem encolher (tabelas e textos longos não estouram). */
.grade > * {
  min-inline-size: 0;
}
.grade p {
  margin: 0;
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
