// Rótulos em pt-BR dos estados visuais (selo e bloco de agenda). Estado nunca só por cor.
export const ROTULOS_DE_ESTADO = Object.freeze({
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  assinante: 'Assinante',
  fila: 'Na fila',
  faltou: 'Faltou',
  encaixe: 'Encaixe',
  bloqueado: 'Bloqueado',
  atendido: 'Atendido',
  cancelado: 'Cancelado',
  neutro: '',
});

/** Estado visual de selo e bloco de agenda. */
export type EstadoVisual = keyof typeof ROTULOS_DE_ESTADO;
