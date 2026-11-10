// Regras de agenda compartilhadas entre front e API (scope:shared). Puras, sem framework.
// Horas são strings 'HH:MM' (24 h); datas são strings ISO 'AAAA-MM-DD' no fuso da unidade.

/** Estados de um agendamento. "bloqueado" representa bloqueio de horário (almoço, folga). */
export const ESTADOS_DE_AGENDAMENTO = Object.freeze([
  'pendente',
  'confirmado',
  'atendido',
  'faltou',
  'cancelado',
  'bloqueado',
]);

/** Estados que deixam o horário livre de novo. */
const LIBERAM_HORARIO = new Set(['cancelado']);

export const ocupaHorario = (estado: string): boolean =>
  !LIBERAM_HORARIO.has(estado);

/** '09:30' → 570 */
export function paraMinutos(hora: string): number {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + m;
}

/** 570 → '09:30' */
export function paraHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Fim de um atendimento: fimDe('09:30', 45) → '10:15'. */
export const fimDe = (inicio: string, duracao: number): string =>
  paraHora(paraMinutos(inicio) + duracao);

/** Intervalo de horas 'HH:MM' (fim exclusivo). */
export interface Intervalo {
  inicio: string;
  fim: string;
}

/** Dois intervalos { inicio, fim } se sobrepõem (encostar não conta). */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return (
    paraMinutos(a.inicio) < paraMinutos(b.fim) &&
    paraMinutos(b.inicio) < paraMinutos(a.fim)
  );
}

/** Intervalo, em minutos, entre os horários oferecidos na agenda. */
export const PASSO_DA_GRADE = 30;

/**
 * Horários de início possíveis para um serviço, no passo dado.
 * - expediente: { inicio, fim } do profissional
 * - duracao: minutos do serviço
 * - ocupados: intervalos { inicio, fim } já tomados (agendamentos e bloqueios)
 * - aPartirDe: hora mínima (ex.: agora, quando o dia é hoje)
 * → [{ hora, disponivel }]
 */
export function horariosLivres({
  expediente,
  duracao,
  ocupados = [],
  passo = PASSO_DA_GRADE,
  aPartirDe,
}: {
  expediente: Intervalo;
  duracao: number;
  ocupados?: Intervalo[];
  passo?: number;
  aPartirDe?: string | null;
}): { hora: string; disponivel: boolean }[] {
  const resultado: { hora: string; disponivel: boolean }[] = [];
  const limite = paraMinutos(expediente.fim);
  const minimo = aPartirDe ? paraMinutos(aPartirDe) : -1;
  for (
    let m = paraMinutos(expediente.inicio);
    m + duracao <= limite;
    m += passo
  ) {
    const candidato = { inicio: paraHora(m), fim: paraHora(m + duracao) };
    const disponivel =
      m >= minimo && !ocupados.some((o) => sobrepoe(candidato, o));
    resultado.push({ hora: candidato.inicio, disponivel });
  }
  return resultado;
}

/** O horário cai na grade de `horariosLivres` (a partir do início do expediente)? */
export function naGrade(
  inicio: string,
  expedienteInicio: string,
  passo = PASSO_DA_GRADE,
): boolean {
  const deslocamento = paraMinutos(inicio) - paraMinutos(expedienteInicio);
  return Number.isInteger(deslocamento) && deslocamento % passo === 0;
}

// ---- datas (ISO local) ----

const paraData = (iso: string): Date => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const paraIso = (data: Date): string =>
  [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0'),
  ].join('-');

/** Data de hoje no fuso local: '2026-11-07'. */
export const hojeIso = (agora: Date = new Date()): string => paraIso(agora);

/** somarDias('2026-11-30', 1) → '2026-12-01' */
export function somarDias(iso: string, dias: number): string {
  const data = paraData(iso);
  data.setDate(data.getDate() + dias);
  return paraIso(data);
}

/** 0 = domingo ... 6 = sábado */
export const diaDaSemana = (iso: string): number => paraData(iso).getDay();

/** somarMeses('2026-01-31', 1) → '2026-02-28' (fica no último dia se o mês for menor). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimo));
  return paraIso(alvo);
}

/** Dias corridos de a até b (b - a). */
export const diasEntre = (a: string, b: string): number =>
  Math.round((paraData(b).getTime() - paraData(a).getTime()) / 86_400_000);

/** Segunda-feira da semana da data. */
export function inicioDaSemana(iso: string): string {
  const deslocamento = (diaDaSemana(iso) + 6) % 7;
  return somarDias(iso, -deslocamento);
}

/** '2026-11-14' → '14/11' (mensagens do domínio, sem depender de lib de UI). */
export const diaEMes = (iso: string): string => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}/${m}`;
};
