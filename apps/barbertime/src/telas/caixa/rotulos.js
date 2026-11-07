import { FORMAS_DE_PAGAMENTO } from '@barbertime/dominio';

export const rotuloDaForma = (forma) =>
  FORMAS_DE_PAGAMENTO.find((f) => f.valor === forma)?.rotulo ?? '—';

const SELOS = {
  aberta: { estado: 'pendente', texto: 'Aberta' },
  paga: { estado: 'confirmado', texto: 'Paga' },
  cancelada: { estado: 'neutro', texto: 'Cancelada' },
};
export const seloDaComanda = (estado) => SELOS[estado] ?? SELOS.aberta;
