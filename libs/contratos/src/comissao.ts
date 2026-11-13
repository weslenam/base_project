/** Linha de comissão de uma comanda paga (GET /comissao). */
export interface LinhaDeComissao {
  id: number;
  barbeiroId: number;
  barbeiroNome: string;
  comandaId: number;
  dataComanda: string;
  baseCalculo: number;
  taxa: number;
  valor: number;
  observacao: string | null;
  fechamentoId: number | null;
}

/** Período de comissão fechado (POST /comissao/fechar). */
export interface FechamentoDeComissao {
  id: number;
  barbeiroId: number;
  barbeiroNome: string;
  de: string;
  ate: string;
  total: number;
  fechadoPor: number | null;
  fechadoEm: string;
}
