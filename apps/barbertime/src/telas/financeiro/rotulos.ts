// Rótulos do financeiro (planejamento 0027, parte 2).
import { FORMAS_DE_BAIXA } from '@barbertime/dominio';
import type { Selo } from '../estados.ts';

export const SITUACOES = [
  { valor: 'aberta', rotulo: 'Em aberto' },
  { valor: 'vencida', rotulo: 'Vencidas' },
  { valor: 'quitada', rotulo: 'Pagas' },
  { valor: 'cancelada', rotulo: 'Canceladas' },
  { valor: 'todas', rotulo: 'Todas' },
];

/** Selo da situação atual (aberta, vencida, quitada, cancelada) por tipo. */
export function seloDaSituacao(
  situacao: string | undefined,
  tipo: string,
): Selo {
  const selos: Record<string, Selo> = {
    aberta: { estado: 'pendente', texto: 'Em aberto' },
    vencida: { estado: 'faltou', texto: 'Vencida' },
    quitada: {
      estado: 'confirmado',
      texto: tipo === 'receber' ? 'Recebida' : 'Paga',
    },
    cancelada: { estado: 'neutro', texto: 'Cancelada' },
  };
  // Situação nova da API aparece com o próprio nome, nunca como selo vazio.
  return situacao && Object.hasOwn(selos, situacao)
    ? (selos[situacao] ?? { estado: 'neutro', texto: situacao })
    : { estado: 'neutro', texto: situacao ?? '' };
}

export const ROTULO_DA_FORMA: Record<string, string> = Object.fromEntries(
  FORMAS_DE_BAIXA.map((f) => [f.valor, f.rotulo]),
);
