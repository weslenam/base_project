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
