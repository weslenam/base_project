import { formatarMoeda } from '@barbertime/ui-utils';
import type { Pacote } from '../../dados/modelos.ts';

/** O que as descrições leem de um pacote (do catálogo ou de um formulário). */
type PacoteDescrito = Pick<Pacote, 'tipo' | 'validadeDias' | 'preco'> & {
  itens: Pick<Pacote['itens'][number], 'quantidade' | 'servicoNome'>[];
  limites?: Partial<Pacote['limites']>;
};

/** Textos curtos de um pacote para listas e cartões. */
export const descreverItens = (p: Pick<PacoteDescrito, 'itens'>) =>
  p.itens
    .map((i) => `${i.quantidade ?? 'livre'} × ${i.servicoNome}`)
    .join(' + ');

export const descreverVigencia = (
  p: Pick<PacoteDescrito, 'tipo' | 'validadeDias'>,
) =>
  p.tipo === 'recorrente'
    ? 'Mensal, renovável'
    : `Compra única · ${p.validadeDias} dias`;

export function descreverLimites(p: Pick<PacoteDescrito, 'limites'>) {
  const partes: string[] = [];
  if (p.limites?.intervaloMinimoDias)
    partes.push(`a cada ${p.limites.intervaloMinimoDias} dias`);
  if (p.limites?.maximoPorSemana)
    partes.push(`até ${p.limites.maximoPorSemana}× por semana`);
  return partes.length ? partes.join(' · ') : 'sem limite';
}

export const descreverPreco = (p: Pick<PacoteDescrito, 'preco' | 'tipo'>) =>
  `${formatarMoeda(p.preco)}${p.tipo === 'recorrente' ? '/mês' : ''}`;
