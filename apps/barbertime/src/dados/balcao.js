import { http } from './http.js';

/**
 * Balcão (planejamento 0020, fase 1). Sempre pela API real, como a
 * administração: os testes do front simulam o fetch.
 */
export const balcao = {
  painel: () => http('GET', '/api/balcao'),
  encaixe: (servicoId) =>
    http(
      'GET',
      `/api/balcao/encaixe?servicoId=${encodeURIComponent(servicoId)}`,
    ),
  avulso: (dados) => http('POST', '/api/balcao/avulsos', dados),
  checkin: (id) => http('POST', `/api/atendimentos/${id}/checkin`),
  iniciar: (id, barbeiroId) =>
    http('POST', `/api/atendimentos/${id}/iniciar`, { barbeiroId }),
  finalizar: (id) => http('POST', `/api/atendimentos/${id}/finalizar`),
  desistir: (id) => http('POST', `/api/atendimentos/${id}/desistir`),
  noShow: (id) => http('POST', `/api/atendimentos/${id}/no-show`),
  pausa: (barbeiroId, emPausa) =>
    http('POST', `/api/barbeiros/${barbeiroId}/pausa`, { emPausa }),
  abrirCaixa: (valorInicial) =>
    http('POST', '/api/caixa/abrir', { valorInicial }),
};
