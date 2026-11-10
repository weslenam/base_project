const LOCALE = 'pt-BR';

const formatoData = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'America/Sao_Paulo',
});
const formatoMoeda = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'BRL',
});

const DATA_PURA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data no formato dd/mm/aaaa. Aceita Date, timestamp ou string ISO. */
export function formatarData(
  valor: Date | string | number | null | undefined,
): string {
  if (valor === null || valor === undefined || valor === '') return '';
  // Data pura (AAAA-MM-DD, como as do banco) é um dia do calendário, sem fuso:
  // lida como meia-noite UTC, voltaria um dia no Brasil (issue #21).
  const pura = typeof valor === 'string' && DATA_PURA.exec(valor);
  if (pura) {
    const [, ano, mes, dia] = pura.map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
      ? `${pura[3]}/${pura[2]}/${pura[1]}`
      : '';
  }
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : formatoData.format(data);
}

/** Valor em reais (R$ 1.234,56). */
export function formatarMoeda(
  valor: string | number | null | undefined,
): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = Number(valor);
  return Number.isNaN(numero) ? '' : formatoMoeda.format(numero);
}

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Data ISO curta, como no guia da identidade: '2026-11-08' → 'Dom, 8/11'. */
export function formatarDiaCurto(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-').map(Number);
  const data = new Date(a, m - 1, d);
  if (Number.isNaN(data.getTime())) return '';
  return `${DIAS_CURTOS[data.getDay()]}, ${d}/${m}`;
}
