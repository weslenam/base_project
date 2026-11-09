import { formatarMoeda } from '@barbertime/ui-utils';

/** Textos curtos de um pacote para listas e cartões. */
export const descreverItens = (p) =>
  p.itens
    .map((i) => `${i.quantidade ?? 'livre'} × ${i.servicoNome}`)
    .join(' + ');

export const descreverVigencia = (p) =>
  p.tipo === 'recorrente'
    ? 'Mensal, renovável'
    : `Compra única · ${p.validadeDias} dias`;

export function descreverLimites(p) {
  const partes = [];
  if (p.limites?.intervaloMinimoDias)
    partes.push(`a cada ${p.limites.intervaloMinimoDias} dias`);
  if (p.limites?.maximoPorSemana)
    partes.push(`até ${p.limites.maximoPorSemana}× por semana`);
  return partes.length ? partes.join(' · ') : 'sem limite';
}

export const descreverPreco = (p) =>
  `${formatarMoeda(p.preco)}${p.tipo === 'recorrente' ? '/mês' : ''}`;
