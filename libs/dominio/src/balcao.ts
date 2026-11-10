// Balcão (planejamento 0020, especificação docs/atendimento/balcao.md):
// ciclo de vida do atendimento, fila e encaixe sem atropelar quem agendou.
import { paraHora, paraMinutos } from './agenda.ts';
import type { Intervalo } from './agenda.ts';

/** Atendimento como as regras do balcão o enxergam. */
export interface AtendimentoBalcao {
  id: number;
  estado: string;
  barbeiroId?: number | null;
  servicoId?: number | null;
  inicio?: string | null;
  fim?: string | null;
  chegouAs?: string | null;
  iniciadoAs?: string | null;
  duracao?: number | null;
  /** Data da confirmação (a API manda Date; o front, texto). */
  confirmadoEm?: string | Date | null;
}

/** Barbeiro com expediente e pausa. */
export interface BarbeiroBalcao {
  id: number;
  nome: string;
  inicio: string;
  fim: string;
  emPausa?: boolean;
}

/** Situação de um barbeiro agora (ver situacaoDosBarbeiros). */
export interface SituacaoDoBarbeiro {
  id: number;
  nome: string;
  expediente: Intervalo;
  estado: 'pausa' | 'ocupado' | 'livre';
  atual: AtendimentoBalcao | null;
  livreEm: string;
  restanteMin: number;
  reservados: AtendimentoBalcao[];
}

export const ESTADOS_DE_ATENDIMENTO = Object.freeze([
  'agendado',
  'chegou',
  'na_fila',
  'em_atendimento',
  'finalizado',
  'pago',
  'desistiu',
  'no_show',
  'cancelado',
]);

const TRANSICOES: Record<string, string[]> = {
  agendado: ['chegou', 'no_show', 'cancelado'],
  chegou: ['em_atendimento', 'desistiu', 'cancelado'],
  na_fila: ['em_atendimento', 'desistiu'],
  em_atendimento: ['finalizado'],
  finalizado: ['pago'],
};
export const podeTransitar = (de: string, para: string): boolean =>
  Boolean(TRANSICOES[de]?.includes(para));

/** Configurações do balcão por barbearia (com os padrões da especificação). */
export const BALCAO_PADRAO = Object.freeze({
  folgaMinutos: 5,
  toleranciaMinutos: 10,
  exigirTelefone: false,
});

/**
 * A agenda (tela atual) ainda fala o vocabulário antigo; esta é a tradução
 * do status do atendimento para ela.
 */
export function estadoNaAgenda({
  estado,
  confirmadoEm,
}: Pick<AtendimentoBalcao, 'estado' | 'confirmadoEm'>): string {
  if (estado === 'agendado') return confirmadoEm ? 'confirmado' : 'pendente';
  const traducao: Record<string, string> = {
    chegou: 'confirmado',
    na_fila: 'pendente',
    em_atendimento: 'confirmado',
    finalizado: 'atendido',
    pago: 'atendido',
    no_show: 'faltou',
    desistiu: 'cancelado',
    cancelado: 'cancelado',
  };
  return traducao[estado] ?? estado;
}

/** Agendado que ainda segura o horário: não chegou e não passou da tolerância. */
const seguraHorario = (
  a: AtendimentoBalcao,
  agora: string,
  tolerancia: number,
): boolean =>
  (a.estado === 'agendado' &&
    paraMinutos(a.inicio ?? '') + tolerancia >= paraMinutos(agora)) ||
  (a.estado === 'chegou' && !atrasado(a, tolerancia));

/** Chegou depois do horário marcado + tolerância. */
export const atrasado = (a: AtendimentoBalcao, tolerancia: number): boolean =>
  a.estado === 'chegou' &&
  Boolean(a.chegouAs) &&
  paraMinutos(a.chegouAs ?? '') > paraMinutos(a.inicio ?? '') + tolerancia;

/**
 * Ordem da fila (especificação):
 *  1. agendado que chegou dentro da tolerância (pelo horário marcado);
 *  2. agendado atrasado: perde o horário reservado, mas fica à frente dos avulsos;
 *  3. avulsos por ordem de chegada.
 */
export function ordenarFila<A extends AtendimentoBalcao>(
  itens: A[],
  tolerancia: number = BALCAO_PADRAO.toleranciaMinutos,
): A[] {
  const grupo = (a: A) =>
    a.estado === 'chegou' ? (atrasado(a, tolerancia) ? 2 : 1) : 3;
  const chave = (a: A) =>
    grupo(a) === 1
      ? paraMinutos(a.inicio ?? '')
      : paraMinutos(a.chegouAs ?? '00:00');
  return itens
    .filter((a) => a.estado === 'chegou' || a.estado === 'na_fila')
    .slice()
    .sort((a, b) => grupo(a) - grupo(b) || chave(a) - chave(b) || a.id - b.id);
}

/**
 * Situação de cada barbeiro agora: pausa, ocupado (até quando) ou livre, e os
 * agendados que ainda seguram horário (o avulso não pode atropelá-los).
 */
export function situacaoDosBarbeiros({
  barbeiros,
  atendimentos,
  agora,
  tolerancia = BALCAO_PADRAO.toleranciaMinutos,
}: {
  barbeiros: BarbeiroBalcao[];
  atendimentos: AtendimentoBalcao[];
  agora: string;
  tolerancia?: number;
}): SituacaoDoBarbeiro[] {
  return barbeiros.map((b) => {
    const meus = atendimentos.filter((a) => a.barbeiroId === b.id);
    const atual = meus.find((a) => a.estado === 'em_atendimento') ?? null;
    const fimAtual = atual
      ? paraMinutos(atual.iniciadoAs ?? agora) + (atual.duracao ?? 30)
      : 0;
    const livreEm = paraHora(Math.max(paraMinutos(agora), fimAtual));
    const reservados = meus
      .filter((a) => a.inicio && seguraHorario(a, agora, tolerancia))
      .filter((a) => a.id !== atual?.id)
      .sort(
        (x, y) => paraMinutos(x.inicio ?? '') - paraMinutos(y.inicio ?? ''),
      );
    return {
      id: b.id,
      nome: b.nome,
      expediente: { inicio: b.inicio, fim: b.fim },
      estado: (b.emPausa
        ? 'pausa'
        : atual
          ? 'ocupado'
          : 'livre') as SituacaoDoBarbeiro['estado'],
      atual,
      livreEm,
      restanteMin: atual ? Math.max(0, fimAtual - paraMinutos(agora)) : 0,
      reservados,
    };
  });
}

/** Primeiro minuto >= t em que cabe `duracao + folga` antes do próximo reservado. */
function primeiraJanela(
  t: number,
  reservados: AtendimentoBalcao[],
  duracao: number,
  folga: number,
  fimExpediente: number,
): number | null {
  let inicio = t;
  for (const r of reservados) {
    const ri = paraMinutos(r.inicio ?? '');
    const rf = paraMinutos(r.fim ?? '');
    if (rf <= inicio) continue;
    if (ri - inicio >= duracao + folga) break;
    inicio = Math.max(inicio, rf);
  }
  return inicio + duracao <= fimExpediente ? inicio : null;
}

/**
 * Encaixe de um avulso novo, por barbeiro (especificação):
 *   janela = próximo agendado − (agora ou fim do atual)
 *   pode agora = livre E janela ≥ duração + folga
 * A fila que já espera é simulada antes (cada um vai para o seu barbeiro ou, se
 * "primeiro livre", para quem puder começar mais cedo). Devolve, por barbeiro:
 * { barbeiroId, podeAgora, inicioPrevisto, esperaMin } (inicioPrevisto null =
 * não cabe hoje), mais a sugestão de "primeiro livre".
 */
export function sugerirEncaixe({
  situacao,
  fila = [],
  duracoes = {},
  duracao,
  agora,
  folga = BALCAO_PADRAO.folgaMinutos,
}: {
  situacao: SituacaoDoBarbeiro[];
  fila?: AtendimentoBalcao[];
  duracoes?: Record<number, number>;
  duracao: number;
  agora: string;
  folga?: number;
}) {
  const ativos = situacao.filter((s) => s.estado !== 'pausa');
  const t = new Map(ativos.map((s) => [s.id, paraMinutos(s.livreEm)]));
  const proximoInicio = (s: SituacaoDoBarbeiro, dur: number) =>
    primeiraJanela(
      t.get(s.id) ?? 0,
      s.reservados,
      dur,
      folga,
      paraMinutos(s.expediente.fim),
    );

  for (const item of fila) {
    const dur =
      item.duracao ??
      (item.servicoId != null ? duracoes[item.servicoId] : undefined) ??
      30;
    const candidatos = item.barbeiroId
      ? ativos.filter((s) => s.id === item.barbeiroId)
      : ativos;
    let melhor: { s: SituacaoDoBarbeiro; ini: number } | null = null;
    for (const s of candidatos) {
      const ini = proximoInicio(s, dur);
      if (ini !== null && (melhor === null || ini < melhor.ini))
        melhor = { s, ini };
    }
    if (melhor) t.set(melhor.s.id, melhor.ini + dur);
  }

  const agoraMin = paraMinutos(agora);
  const porBarbeiro = situacao.map((s) => {
    if (s.estado === 'pausa')
      return {
        barbeiroId: s.id,
        podeAgora: false,
        inicioPrevisto: null,
        esperaMin: null,
      };
    const ini = proximoInicio(s, duracao);
    return {
      barbeiroId: s.id,
      podeAgora: ini !== null && s.estado === 'livre' && ini <= agoraMin,
      inicioPrevisto: ini === null ? null : paraHora(ini),
      esperaMin: ini === null ? null : Math.max(0, ini - agoraMin),
    };
  });
  const possiveis = porBarbeiro.filter((p) => p.inicioPrevisto !== null);
  const primeiroLivre =
    possiveis.sort((a, b) => (a.esperaMin ?? 0) - (b.esperaMin ?? 0))[0] ??
    null;
  return { porBarbeiro, primeiroLivre };
}
