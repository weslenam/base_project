import { FORMAS_DE_PAGAMENTO } from '@barbertime/dominio';
import type { Selo } from '../estados.ts';

export const rotuloDaForma = (forma: string | null | undefined): string =>
  FORMAS_DE_PAGAMENTO.find((f) => f.valor === forma)?.rotulo ?? '—';

const SELOS = {
  aberta: { estado: 'pendente', texto: 'Aberta' },
  paga: { estado: 'confirmado', texto: 'Paga' },
  cancelada: { estado: 'neutro', texto: 'Cancelada' },
} satisfies Record<string, Selo>;
export const seloDaComanda = (estado: string): Selo =>
  Object.hasOwn(SELOS, estado)
    ? SELOS[estado as keyof typeof SELOS]
    : SELOS.aberta;
