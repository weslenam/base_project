// Contratos do financeiro (planejamento 0040, etapa 4): o formato das
// respostas que o front consome. A libs/contratos junta tudo na etapa 9.

/** Categoria de contas (GET /financeiro/categorias e o salvar). */
export interface CategoriaFinanceira {
  id: number;
  tipo: string;
  nome: string;
  ativa: boolean;
  /** Tem conta: não se exclui, só se desativa. */
  emUso: boolean;
}

/** Recorrência financeira (gera contas automaticamente para os próximos 3 meses). */
export interface RecorrenciaFinanceira {
  id: number;
  tipo: string;
  descricao: string;
  categoriaId: number;
  categoriaNome: string;
  valor: number;
  diaDoMes: number;
  fornecedorId: number | null;
  fornecedorNome: string | null;
  encerradaEm: string | null;
}

/** Agrupamento de contas abertas por semana para a previsão de fluxo de caixa. */
export interface SemanaDePrevisao {
  inicio: string;
  fim: string;
  pagar: number;
  receber: number;
  saldo: number;
}

/** Resultado de GET /financeiro/previsao. */
export interface PrevisaoFinanceira {
  semanas: SemanaDePrevisao[];
  vencidaPagar: number;
  vencidaReceber: number;
  totalPagar: number;
  totalReceber: number;
  saldoPrevisto: number;
  categorias: { nome: string; tipo: string; total: number }[];
}

/** Conta a pagar ou a receber, com a situação de hoje (data da barbearia). */
export interface ContaFinanceira {
  id: number;
  tipo: string;
  descricao: string;
  categoriaId: number;
  categoriaNome: string;
  valor: number;
  vencimento: string;
  fornecedorId: number | null;
  fornecedorNome: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  compraId: number | null;
  recorrenciaId: number | null;
  parcela: number | null;
  parcelas: number | null;
  origem: string;
  situacao: string;
  pagoEm: string | null;
  valorPago: number | null;
  forma: string | null;
  /** aberta, vencida, quitada ou cancelada. */
  situacaoAtual: string | undefined;
}
