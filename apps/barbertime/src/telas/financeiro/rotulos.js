// Rótulos do financeiro (planejamento 0027, parte 2).
import { FORMAS_DE_BAIXA } from '@barbertime/dominio';

export const SITUACOES = [
  { valor: 'aberta', rotulo: 'Em aberto' },
  { valor: 'vencida', rotulo: 'Vencidas' },
  { valor: 'quitada', rotulo: 'Pagas' },
  { valor: 'cancelada', rotulo: 'Canceladas' },
  { valor: 'todas', rotulo: 'Todas' },
];

/** Selo da situação atual (aberta, vencida, quitada, cancelada) por tipo. */
export function seloDaSituacao(situacao, tipo) {
  return {
    aberta: { estado: 'pendente', texto: 'Em aberto' },
    vencida: { estado: 'faltou', texto: 'Vencida' },
    quitada: {
      estado: 'confirmado',
      texto: tipo === 'receber' ? 'Recebida' : 'Paga',
    },
    cancelada: { estado: 'neutro', texto: 'Cancelada' },
  }[situacao];
}

export const ROTULO_DA_FORMA = Object.fromEntries(
  FORMAS_DE_BAIXA.map((f) => [f.valor, f.rotulo]),
);
