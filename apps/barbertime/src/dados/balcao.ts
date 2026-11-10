import type {
  Atendimento,
  Barbeiro,
  Caixa,
  Encaixe,
  Painel,
} from './modelos.ts';
import { http } from './http.ts';

/** Avulso que chega ao balcão (sem horário marcado). */
export interface NovoAvulso {
  servicoId: number;
  barbeiroId?: number | null;
  telefone?: string | null;
  nome?: string | null;
}

/**
 * Balcão (planejamento 0020, fase 1). Sempre pela API real, como a
 * administração: os testes do front simulam o fetch.
 */
export const balcao = {
  painel: () => http<Painel>('GET', '/api/balcao'),
  encaixe: (servicoId: number) =>
    http<Encaixe>(
      'GET',
      `/api/balcao/encaixe?servicoId=${encodeURIComponent(servicoId)}`,
    ),
  avulso: (dados: NovoAvulso) =>
    http<Atendimento>('POST', '/api/balcao/avulsos', dados),
  checkin: (id: number) =>
    http<Atendimento>('POST', `/api/atendimentos/${id}/checkin`),
  iniciar: (id: number, barbeiroId?: number | null) =>
    http<Atendimento>('POST', `/api/atendimentos/${id}/iniciar`, {
      barbeiroId,
    }),
  finalizar: (id: number) =>
    http<Atendimento>('POST', `/api/atendimentos/${id}/finalizar`),
  desistir: (id: number) =>
    http<Atendimento>('POST', `/api/atendimentos/${id}/desistir`),
  noShow: (id: number) =>
    http<Atendimento>('POST', `/api/atendimentos/${id}/no-show`),
  pausa: (barbeiroId: number, emPausa: boolean) =>
    http<Barbeiro>('POST', `/api/barbeiros/${barbeiroId}/pausa`, {
      emPausa,
    }),
  abrirCaixa: (valorInicial: number) =>
    http<Caixa>('POST', '/api/caixa/abrir', { valorInicial }),
};
