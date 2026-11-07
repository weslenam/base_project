const LOCALE = 'pt-BR';

const formatoData = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'America/Sao_Paulo',
});
const formatoMoeda = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'BRL',
});

/** Data no formato dd/mm/aaaa. Aceita Date, timestamp ou string ISO. */
export function formatarData(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : formatoData.format(data);
}

/** Valor em reais (R$ 1.234,56). */
export function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = Number(valor);
  return Number.isNaN(numero) ? '' : formatoMoeda.format(numero);
}
