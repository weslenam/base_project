import { http } from './http.ts';

/**
 * Balcão (planejamento 0020, fase 1). Sempre pela API real, como a
 * administração: os testes do front simulam o fetch. As respostas ganham
 * contrato quando a tela do balcão virar TypeScript (planejamento 0040).
 */
export const balcao = {
  painel: () => http<unknown>('GET', '/api/balcao'),
  encaixe: (servicoId: number) =>
    http<unknown>(
      'GET',
      `/api/balcao/encaixe?servicoId=${encodeURIComponent(servicoId)}`,
    ),
  avulso: (dados: Record<string, unknown>) =>
    http<unknown>('POST', '/api/balcao/avulsos', dados),
  checkin: (id: number) =>
    http<unknown>('POST', `/api/atendimentos/${id}/checkin`),
  iniciar: (id: number, barbeiroId?: number | null) =>
    http<unknown>('POST', `/api/atendimentos/${id}/iniciar`, { barbeiroId }),
  finalizar: (id: number) =>
    http<unknown>('POST', `/api/atendimentos/${id}/finalizar`),
  desistir: (id: number) =>
    http<unknown>('POST', `/api/atendimentos/${id}/desistir`),
  noShow: (id: number) =>
    http<unknown>('POST', `/api/atendimentos/${id}/no-show`),
  pausa: (barbeiroId: number, emPausa: boolean) =>
    http<unknown>('POST', `/api/barbeiros/${barbeiroId}/pausa`, { emPausa }),
  abrirCaixa: (valorInicial: number) =>
    http<unknown>('POST', '/api/caixa/abrir', { valorInicial }),
};
