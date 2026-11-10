import type { EstadoVisual } from '@barbertime/ui';

/** Selo de um estado: o visual do DsSelo e a palavra (nunca só cor). */
export interface Selo {
  estado: EstadoVisual;
  texto: string;
}

// Como cada estado de agendamento aparece no DsSelo (sempre com palavra).
const SELOS = {
  pendente: { estado: 'pendente', texto: 'Pendente' },
  confirmado: { estado: 'confirmado', texto: 'Confirmado' },
  atendido: { estado: 'neutro', texto: 'Atendido' },
  faltou: { estado: 'faltou', texto: 'Faltou' },
  cancelado: { estado: 'neutro', texto: 'Cancelado' },
  bloqueado: { estado: 'neutro', texto: 'Bloqueado' },
} satisfies Record<string, Selo>;
export const seloDoEstado = (estado: string): Selo =>
  Object.hasOwn(SELOS, estado)
    ? SELOS[estado as keyof typeof SELOS]
    : SELOS.pendente;
